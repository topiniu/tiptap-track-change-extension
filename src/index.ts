import { ReplaceStep, Step } from '@tiptap/pm/transform'
import { TextSelection, Plugin, PluginKey } from '@tiptap/pm/state'
import { Slice, Fragment } from '@tiptap/pm/model'
import {Extension, Mark, getMarkRange, getMarksBetween, isMarkActive, mergeAttributes} from '@tiptap/core'
import type { CommandProps, Editor, MarkRange} from '@tiptap/core'
import type { EditorState, Transaction } from '@tiptap/pm/state'

const LOG_ENABLED = true

export const MARK_DELETION = 'deletion'
export const MARK_INSERTION = 'insertion'
export const EXTENSION_NAME = 'trackchange'

// Track Change Operations
export const TRACK_COMMAND_ACCEPT = 'accept'
export const TRACK_COMMAND_ACCEPT_ALL = 'accept-all'
export const TRACK_COMMAND_REJECT = 'reject'
export const TRACK_COMMAND_REJECT_ALL = 'reject-all'
const TRACK_MANUAL_CHANGED_META = 'trackManualChanged'

export type TRACK_COMMAND_TYPE = 'accept' | 'accept-all' | 'reject' | 'reject-all'
type TrackChangeOptions = {
  enabled: boolean
  onStatusChange?: (enabled: boolean) => void
  dataOpUserId?: string
  dataOpUserNickname?: string
}
type TrackChangeStorage = {
  enabled: boolean
  dataOpUserId: string
  dataOpUserNickname: string
}
type ImeContext = {
  isChineseStart: boolean
  isChineseInputting: boolean
  isNormalInput: boolean
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    trackchange: {
      /**
       * change track change extension enabled status
       * we don't use a external function instead，so we can use a editor.command anywhere without another variable
       * @param enabled
       * @returns 
       */
      setTrackChangeStatus: (enabled: boolean) => ReturnType,
      getTrackChangeStatus: () => ReturnType,
      toggleTrackChangeStatus: () => ReturnType,
      /**
       * accept one change: auto recognize the selection or left near by cursor pos
       */
      acceptChange: () => ReturnType, 
      /**
       * accept all changes: mark insertion as normal, and remove all the deletion nodes
       */
      acceptAllChanges: () => ReturnType, 
      /**
       * same to accept
       */
      rejectChange: () => ReturnType, 
      /**
       * same to acceptAll but: remove deletion mark and remove all insertion nodes
       */
      rejectAllChanges: () => ReturnType, 
      /**
       * 
       */
      updateOpUserOption: (opUserId: string, opUserNickname: string) => ReturnType
    }
  }
}

// insert mark
export const InsertionMark = Mark.create({
  name: MARK_INSERTION,
  addAttributes () {
    return {
      'data-op-user-id': {
        type: 'string',
        default: () => '',
      },
      'data-op-user-nickname': {
        type: 'string',
        default: () => '',
      },
      'data-op-date': {
        type: 'string',
        default: () => '',
      }
    }
  },
  parseHTML () {
    return [
      { tag: 'insert' }
    ]
  },
  renderHTML ({ HTMLAttributes }) {
    return ['insert', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes), 0]
  }
})

// delete mark
export const DeletionMark = Mark.create({
  name: MARK_DELETION,
  addAttributes () {
    return {
      'data-op-user-id': {
        type: 'string',
        default: () => '',
      },
      'data-op-user-nickname': {
        type: 'string',
        default: () => '',
      },
      'data-op-date': {
        type: 'string',
        default: () => '',
      }
    }
  },
  parseHTML () {
    return [
      { tag: 'delete' }
    ]
  },
  renderHTML ({ HTMLAttributes }) {
    return ['delete', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes), 0]
  }
})

// save the ime-mode status, when input chinese char, the extension needs to deal the change with a special strategy 
// TODO: Is it necessary to save these two variable into a tiptap instance when someone open two editor
const IME_STATUS_NORMAL = 0
const IME_STATUS_START = 1
const IME_STATUS_CONTINUE = 2
const IME_STATUS_FINISHED = 3
type IME_STATUS_TYPE = 0 | 1 | 2 | 3
let composingStatus: IME_STATUS_TYPE = 0 // 0: normal，1: start with first chat, 2: continue input, 3: finished by confirm or cancel with chars applied
let isStartChineseInput = false

const getSelfStorage = (editor: Editor) => editor.storage[EXTENSION_NAME] as TrackChangeStorage

// get the current minute time, avoid two char with different time splitted with too many marks
const getMinuteTime = () => Math.round(new Date().getTime() / 1000 / 60) * 1000 * 60
const getImeContext = (): ImeContext => {
  const context = {
    isChineseStart: isStartChineseInput && composingStatus === IME_STATUS_CONTINUE,
    isChineseInputting: !isStartChineseInput && composingStatus === IME_STATUS_CONTINUE,
    isNormalInput: composingStatus === IME_STATUS_NORMAL,
  }

  composingStatus = IME_STATUS_NORMAL
  isStartChineseInput = false

  return context
}
const clampSelectionPos = (docSize: number, pos: number) => Math.max(0, Math.min(pos, docSize))
const shouldIgnoreTransaction = (transaction: Transaction) => {
  if (!transaction.docChanged) { return true }
  if (transaction.getMeta(TRACK_MANUAL_CHANGED_META)) { return true }
  if (transaction.getMeta('history$')) { return true }

  const syncMeta = transaction.getMeta('y-sync$')
  if (syncMeta && syncMeta.isChangeOrigin) {
    LOG_ENABLED && console.log('sync from origin', syncMeta)
    return true
  }

  if (!transaction.steps.length) {
    LOG_ENABLED && console.log('none content change')
    return true
  }

  return false
}
const createTrackChangeTransaction = ({
  editor,
  transaction,
  newState,
  imeContext,
}: {
  editor: Editor
  transaction: Transaction
  newState: EditorState
  imeContext: ImeContext
}) => {
  if (shouldIgnoreTransaction(transaction)) { return null }

  const storage = getSelfStorage(editor)
  const trackChangeEnabled = storage.enabled
  const allSteps = transaction.steps.map(step => Step.fromJSON(newState.schema, step.toJSON()))
  const currentNewPos = transaction.selection.from
  let posOffset = 0
  let hasAddAndDelete = false

  allSteps.forEach((step: Step, index: number) => {
    if (!(step instanceof ReplaceStep)) { return }

    let delCount = 0
    if (step.from !== step.to) {
      const slice = transaction.docs[index].slice(step.from, step.to)
      slice.content.forEach(node => {
        const isInsertNode = node.marks.find(m => m.type.name === MARK_INSERTION)
        if (!isInsertNode) {
          delCount += node.nodeSize
        }
      })
    }

    posOffset += delCount
    const newCount = step.slice ? step.slice.size : 0
    if (newCount && delCount) {
      hasAddAndDelete = true
    }
  })

  if (imeContext.isNormalInput) {
    if (!hasAddAndDelete) {
      posOffset = 0
    }
  } else if (imeContext.isChineseStart) {
    if (!hasAddAndDelete) {
      posOffset = 0
    }
  } else if (imeContext.isChineseInputting) {
    posOffset = 0
  }

  LOG_ENABLED && console.table({
    hasAddAndDelete,
    isNormalInput: imeContext.isNormalInput,
    isChineseStart: imeContext.isChineseStart,
    isChineseInputting: imeContext.isChineseInputting,
    posOffset,
  })

  const newChangeTr = newState.tr
  let reAddOffset = 0

  allSteps.forEach((step: Step, index: number) => {
    if (!(step instanceof ReplaceStep)) { return }

    const invertedStep = step.invert(transaction.docs[index])

    if (step.slice.size) {
      const insertionMark = newState.schema.marks.insertion.create({
        'data-op-user-id': storage.dataOpUserId,
        'data-op-user-nickname': storage.dataOpUserNickname,
        'data-op-date': getMinuteTime(),
      })
      const deletionMark = newState.schema.marks.deletion.create()
      const from = step.from + reAddOffset
      const to = step.from + reAddOffset + step.slice.size

      if (trackChangeEnabled) {
        newChangeTr.addMark(from, to, insertionMark)
      } else {
        newChangeTr.removeMark(from, to, insertionMark.type)
      }

      newChangeTr.removeMark(from, to, deletionMark.type)
    }

    if (step.from === step.to || !trackChangeEnabled) { return }

    const skipSteps: Array<ReplaceStep> = []
    const reAddStep = new ReplaceStep(
      invertedStep.from + reAddOffset,
      invertedStep.from + reAddOffset,
      invertedStep.slice,
      // @ts-ignore internal structure flag is preserved from the inverted step
      invertedStep.structure,
    )

    let addedEmptyOffset = 0
    const travelContent = (content: Fragment, parentOffset: number) => {
      content.forEach((node, offset) => {
        const start = parentOffset + offset
        const end = start + node.nodeSize

        if (node.content && node.content.size) {
          travelContent(node.content, start)
          return
        }

        if (node.marks.find(m => m.type.name === MARK_INSERTION)) {
          skipSteps.push(new ReplaceStep(start - addedEmptyOffset, end - addedEmptyOffset, Slice.empty))
          addedEmptyOffset += node.nodeSize
          reAddOffset -= node.nodeSize
        }
      })
    }

    travelContent(invertedStep.slice.content, invertedStep.from)
    reAddOffset += invertedStep.slice.size
    newChangeTr.step(reAddStep)

    const from = reAddStep.from
    const to = from + reAddStep.slice.size
    newChangeTr.addMark(from, to, newChangeTr.doc.type.schema.marks.deletion.create({
      'data-op-user-id': storage.dataOpUserId,
      'data-op-user-nickname': storage.dataOpUserNickname,
      'data-op-date': getMinuteTime(),
    }))

    skipSteps.forEach(skipStep => {
      newChangeTr.step(skipStep)
    })
  })

  if (!newChangeTr.steps.length) { return null }

  if (trackChangeEnabled) {
    const finalNewPos = clampSelectionPos(newChangeTr.doc.content.size, currentNewPos + posOffset)
    newChangeTr.setSelection(TextSelection.create(newChangeTr.doc, finalNewPos))
  }

  newChangeTr.setMeta(TRACK_MANUAL_CHANGED_META, true)
  return newChangeTr
}

/**
 * accept or reject tracked changes for all content or just the selection
 * @param opType operation to apply
 * @param param a command props, so we can get the editor, tr prop
 * @returns null
 */
const changeTrack = (opType: TRACK_COMMAND_TYPE, param: CommandProps) => {
  /**
   * get the range to deal, use selection default
   */
  const from = param.editor.state.selection.from
  const to = param.editor.state.selection.to
  /**
   * find all the mark ranges to deal and remove mark or remove content according by opType
   * if got accept all or reject all, just set 'from' to 0 and 'to' to content size
   * if got just a part range, 
   */
  let markRanges: Array<MarkRange> = []
  /**
   * deal a part and no selection contents, need to recognize the left mark near by cursor
   */
  if ((opType === TRACK_COMMAND_ACCEPT || opType === TRACK_COMMAND_REJECT) && from === to) {
    // detect left mark
    const isInsertBeforeCursor = isMarkActive(param.editor.state, MARK_INSERTION)
    const isDeleteBeforeCursor = isMarkActive(param.editor.state, MARK_DELETION)
    let leftRange
    if (isInsertBeforeCursor) {
      leftRange = getMarkRange(param.editor.state.selection.$from, param.editor.state.doc.type.schema.marks.insertion)
    } else if (isDeleteBeforeCursor) {
      leftRange = getMarkRange(param.editor.state.selection.$from, param.editor.state.doc.type.schema.marks.deletion)
    }
    if (leftRange) {
      markRanges = getMarksBetween(leftRange.from, leftRange.to, param.editor.state.doc)
    }
  } else if (opType === TRACK_COMMAND_ACCEPT_ALL || opType === TRACK_COMMAND_REJECT_ALL) {
    // all editor content
    markRanges = getMarksBetween(0, param.editor.state.doc.content.size, param.editor.state.doc)
    // change the opType to normal
    opType = opType === TRACK_COMMAND_ACCEPT_ALL ? TRACK_COMMAND_ACCEPT : TRACK_COMMAND_REJECT 
  } else {
    // just the selection
    markRanges = getMarksBetween(from, to, param.editor.state.doc)
  }
  // just deal the track change nodes
  markRanges = markRanges.filter(markRange => markRange.mark.type.name === MARK_DELETION || markRange.mark.type.name === MARK_INSERTION)
  if (!markRanges.length) { return false }

  const currentTr = param.tr
  /**
   * mark type and opType compose:
   * 1. accept with insert mark: remove insert mark
   * 2. accept with delete mark: remove content
   * 3. reject with insert mark: remove content
   * 4. reject with delete mark: remove delete mark
   * so
   * 1 and 4 need to remove mark
   * 2 and 3 need to remove content
   */
  // record offset when delete some content to find the correct pos for next range
  let offset = 0
  const removeInsertMark = param.editor.state.doc.type.schema.marks.insertion.create()
  const removeDeleteMark = param.editor.state.doc.type.schema.marks.deletion.create()
  markRanges.forEach((markRange) => {
    const isAcceptInsert = opType === TRACK_COMMAND_ACCEPT && markRange.mark.type.name === MARK_INSERTION
    const isRejectDelete = opType === TRACK_COMMAND_REJECT && markRange.mark.type.name === MARK_DELETION
    if (isAcceptInsert || isRejectDelete) {
      // 1 and 4: remove mark
      currentTr.removeMark(markRange.from - offset, markRange.to - offset, removeInsertMark.type)
      currentTr.removeMark(markRange.from - offset, markRange.to - offset, removeDeleteMark.type)
    } else {
      // 2 and 3 remove content
      currentTr.deleteRange(markRange.from - offset, markRange.to - offset)
      // change the offset
      offset += (markRange.to - markRange.from)
    }
  })
  if (currentTr.steps.length) {
    currentTr.setMeta(TRACK_MANUAL_CHANGED_META, true)
    param.dispatch?.(currentTr)
    return true
  }
  return false
}

// @ts-ignore
/**
 * TODO: some problems to fix or feature to implement
 * 1. when delete content includes two and more paragraphs, cannot mark the new paragraph as insert mark, because the mark is inline, can we add global attrs?
 * 2. when delete content includes two and more paragraphs, connot ignore the insert mark inside the content. Currently, the insert mark is marked as deleted. But it need to be delete directly.
 * 3. select two chars and inout a chinese char, the new char was input with wrong position. (fixed by stop input action)
 * 4. how to toggle to "hide" mode and can record the change ranges too, just look likes the office word
 */
export const TrackChangeExtension = Extension.create<TrackChangeOptions, TrackChangeStorage>({
  name: EXTENSION_NAME,
  addOptions () {
    return {
      enabled: false,
      onStatusChange: undefined,
      dataOpUserId: '',
      dataOpUserNickname: '',
    }
  },
  addStorage () {
    return {
      enabled: this.options.enabled,
      dataOpUserId: this.options.dataOpUserId ?? '',
      dataOpUserNickname: this.options.dataOpUserNickname ?? '',
    }
  },
  onCreate () {
    if (this.options.onStatusChange) {
      this.options.onStatusChange(this.storage.enabled)
    }
  },
  addExtensions () {
    return [InsertionMark, DeletionMark]
  },
  addCommands() {
    return {
      setTrackChangeStatus: (enabled: boolean) => (param: CommandProps) => {
        this.storage.enabled = enabled
        if (this.options.onStatusChange) {
          this.options.onStatusChange(this.storage.enabled)
        }
        return true
      },
      toggleTrackChangeStatus: () => (param: CommandProps) => {
        this.storage.enabled = !this.storage.enabled
        if (this.options.onStatusChange) {
          this.options.onStatusChange(this.storage.enabled)
        }
        return true
      },
      getTrackChangeStatus: () => () => this.storage.enabled,
      acceptChange: () => (param: CommandProps) => {
        return changeTrack('accept', param)
      },
      acceptAllChanges: () => (param: CommandProps) => {
        return changeTrack('accept-all', param)
      },
      rejectChange: () => (param: CommandProps) => {
        return changeTrack('reject', param)
      },
      rejectAllChanges: () => (param: CommandProps) => {
        return changeTrack('reject-all', param)
      },
      updateOpUserOption: (opUserId: string, opUserNickname: string) => (param: CommandProps) => {
        this.storage.dataOpUserId = opUserId
        this.storage.dataOpUserNickname = opUserNickname
        return true
      }
    }
  },
  // @ts-ignore
  onSelectionUpdate (p) {
    // log the status for debug
    LOG_ENABLED && console.log('selection and input status', p.transaction.selection.from, p.transaction.selection.to, p.editor.view.composing)
  },
  // @ts-ignore
  addProseMirrorPlugins () {
    return [
      new Plugin({
        key: new PluginKey<any>('composing-check'),
        appendTransaction: (transactions, _oldState, newState) => {
          const trackedTransactions = transactions.filter(transaction => !transaction.getMeta(TRACK_MANUAL_CHANGED_META))
          const transaction = [...trackedTransactions].reverse().find(item => !shouldIgnoreTransaction(item))

          if (!transaction) { return null }

          LOG_ENABLED && console.warn('内容变化，执行跟踪修订相关逻辑', transaction.steps.length, transaction)
          const imeContext = getImeContext()

          return createTrackChangeTransaction({
            editor: this.editor,
            transaction,
            newState,
            imeContext,
          })
        },
        props: {
          handleDOMEvents: {
            compositionstart: (_event) => {
              LOG_ENABLED && console.log('start chinese input')
              // start and update will fire same time
              isStartChineseInput = true
            },
            compositionupdate: (_event) => {
              LOG_ENABLED && console.log('chinese input continue')
              composingStatus = IME_STATUS_CONTINUE
            }
          }
        }
      })
    ]
  },
})

export default TrackChangeExtension
