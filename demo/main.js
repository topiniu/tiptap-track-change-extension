import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import TrackChangeExtension from '../src/index.ts'

const initialContent = `
  <h2>Track change playground</h2>
  <p>这是一段普通文本，你可以直接在这里输入、删除、替换内容。</p>
  <p>试试先开启修订，再删除“普通文本”四个字，或者把这句改成你自己的版本。</p>
  <ul>
    <li>支持插入修订</li>
    <li>支持删除修订</li>
    <li>支持接受和拒绝</li>
  </ul>
`

const editorElement = document.querySelector('#editor')
const trackStatusElement = document.querySelector('#track-status')
const selectionStatusElement = document.querySelector('#selection-status')
const htmlOutputElement = document.querySelector('#html-output')
const userIdInput = document.querySelector('#user-id')
const userNameInput = document.querySelector('#user-name')

const updateHtmlOutput = (editor) => {
  htmlOutputElement.textContent = editor.getHTML()
}

const updateSelectionStatus = (editor) => {
  const { from, to } = editor.state.selection
  selectionStatusElement.textContent = `光标: ${from} - ${to}`
}

const setTrackStatus = (enabled) => {
  trackStatusElement.textContent = enabled ? '已开启' : '已关闭'
  trackStatusElement.dataset.enabled = String(enabled)
}

const editor = new Editor({
  element: editorElement,
  extensions: [
    StarterKit,
    TrackChangeExtension.configure({
      enabled: true,
      dataOpUserId: userIdInput.value,
      dataOpUserNickname: userNameInput.value,
      onStatusChange: setTrackStatus,
    }),
  ],
  content: initialContent,
  onCreate: ({ editor: currentEditor }) => {
    updateSelectionStatus(currentEditor)
    updateHtmlOutput(currentEditor)
  },
  onSelectionUpdate: ({ editor: currentEditor }) => {
    updateSelectionStatus(currentEditor)
  },
  onUpdate: ({ editor: currentEditor }) => {
    updateHtmlOutput(currentEditor)
  },
})

document.querySelector('#toggle-track').addEventListener('click', () => {
  editor.commands.toggleTrackChangeStatus()
})

document.querySelector('#accept-change').addEventListener('click', () => {
  editor.commands.acceptChange()
  updateHtmlOutput(editor)
})

document.querySelector('#reject-change').addEventListener('click', () => {
  editor.commands.rejectChange()
  updateHtmlOutput(editor)
})

document.querySelector('#accept-all').addEventListener('click', () => {
  editor.commands.acceptAllChanges()
  updateHtmlOutput(editor)
})

document.querySelector('#reject-all').addEventListener('click', () => {
  editor.commands.rejectAllChanges()
  updateHtmlOutput(editor)
})

document.querySelector('#reset-doc').addEventListener('click', () => {
  editor.commands.setContent(initialContent, { emitUpdate: true })
})

document.querySelector('#apply-user').addEventListener('click', () => {
  editor.commands.updateOpUserOption(userIdInput.value, userNameInput.value)
})

window.editor = editor
