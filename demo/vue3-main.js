import { createApp, ref, onBeforeUnmount } from 'vue/dist/vue.esm-bundler.js'
import { EditorContent, useEditor } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import TrackChangeExtension from '../src/index.ts'

const initialContent = `
  <h2>Track change playground</h2>
  <p>这是 Vue 3 版演示，你可以直接在这里输入、删除、替换内容。</p>
  <p>试试先开启修订，再删除“Vue 3 版演示”几个字，或者把这句改成你自己的版本。</p>
  <ul>
    <li>通过 @tiptap/vue-3 渲染编辑器</li>
    <li>复用 TrackChangeExtension 的命令和标记</li>
    <li>在组合式 API 中同步修订状态和 HTML</li>
  </ul>
`

createApp({
  components: {
    EditorContent,
  },
  setup() {
    const trackEnabled = ref(true)
    const selectionStatus = ref('光标: 0 - 0')
    const htmlOutput = ref('')
    const userId = ref('u-1001')
    const userName = ref('Alice')

    const syncSelectionStatus = (editor) => {
      const { from, to } = editor.state.selection
      selectionStatus.value = `光标: ${from} - ${to}`
    }

    const syncHtmlOutput = (editor) => {
      htmlOutput.value = editor.getHTML()
    }

    const editor = useEditor({
      extensions: [
        StarterKit,
        TrackChangeExtension.configure({
          enabled: true,
          dataOpUserId: userId.value,
          dataOpUserNickname: userName.value,
          onStatusChange(enabled) {
            trackEnabled.value = enabled
          },
        }),
      ],
      content: initialContent,
      onCreate: ({ editor: currentEditor }) => {
        syncSelectionStatus(currentEditor)
        syncHtmlOutput(currentEditor)
      },
      onSelectionUpdate: ({ editor: currentEditor }) => {
        syncSelectionStatus(currentEditor)
      },
      onUpdate: ({ editor: currentEditor }) => {
        syncHtmlOutput(currentEditor)
      },
    })

    const withEditor = (callback) => {
      if (!editor.value) {
        return
      }
      callback(editor.value)
    }

    const toggleTrack = () => {
      withEditor((currentEditor) => {
        currentEditor.commands.toggleTrackChangeStatus()
      })
    }

    const acceptChange = () => {
      withEditor((currentEditor) => {
        currentEditor.commands.acceptChange()
        syncHtmlOutput(currentEditor)
      })
    }

    const rejectChange = () => {
      withEditor((currentEditor) => {
        currentEditor.commands.rejectChange()
        syncHtmlOutput(currentEditor)
      })
    }

    const acceptAll = () => {
      withEditor((currentEditor) => {
        currentEditor.commands.acceptAllChanges()
        syncHtmlOutput(currentEditor)
      })
    }

    const rejectAll = () => {
      withEditor((currentEditor) => {
        currentEditor.commands.rejectAllChanges()
        syncHtmlOutput(currentEditor)
      })
    }

    const resetDoc = () => {
      withEditor((currentEditor) => {
        currentEditor.commands.setContent(initialContent, { emitUpdate: true })
      })
    }

    const applyUser = () => {
      withEditor((currentEditor) => {
        currentEditor.commands.updateOpUserOption(userId.value, userName.value)
      })
    }

    onBeforeUnmount(() => {
      editor.value?.destroy()
    })

    return {
      acceptAll,
      acceptChange,
      applyUser,
      editor,
      htmlOutput,
      rejectAll,
      rejectChange,
      resetDoc,
      selectionStatus,
      toggleTrack,
      trackEnabled,
      userId,
      userName,
    }
  },
  template: `
    <div class="app">
      <header class="hero">
        <div>
          <p class="eyebrow">Vue 3 + Tiptap 3.18.0 Demo</p>
          <h1>Track Change Extension</h1>
          <p class="intro">
            这个页面演示如何在 Vue 3 中通过 <code>@tiptap/vue-3</code> 接入修订扩展，并保持和原生 demo 一致的交互能力。
          </p>
        </div>
        <div class="status-card">
          <span class="status-label">当前状态</span>
          <strong id="track-status" :data-enabled="String(trackEnabled)">
            {{ trackEnabled ? '已开启' : '已关闭' }}
          </strong>
          <span class="muted">{{ selectionStatus }}</span>
        </div>
      </header>

      <section class="panel controls">
        <div class="toolbar">
          <button type="button" @click="toggleTrack">切换修订</button>
          <button type="button" @click="acceptChange">接受当前</button>
          <button type="button" @click="rejectChange">拒绝当前</button>
          <button type="button" @click="acceptAll">接受全部</button>
          <button type="button" @click="rejectAll">拒绝全部</button>
          <button type="button" class="ghost" @click="resetDoc">恢复示例内容</button>
        </div>

        <div class="toolbar secondary">
          <label>
            用户 ID
            <input v-model="userId" type="text" />
          </label>
          <label>
            用户昵称
            <input v-model="userName" type="text" />
          </label>
          <button type="button" class="ghost" @click="applyUser">更新操作人</button>
        </div>
      </section>

      <main class="workspace">
        <section class="panel editor-panel">
          <div class="panel-title">编辑区</div>
          <div class="editor">
            <EditorContent v-if="editor" :editor="editor" />
          </div>
        </section>

        <aside class="panel side-panel">
          <div class="panel-title">验证建议</div>
          <ol class="checklist">
            <li>开启修订后输入几个字，应包在绿色下划线的 <code>insert</code> 标签里。</li>
            <li>删除普通文本，应以红色删除线保留在文档里。</li>
            <li>删除刚插入的文本，应直接消失，不保留删除痕迹。</li>
            <li>选中一段普通文本直接输入新内容，应同时产生删除和插入。</li>
            <li>点击“更新操作人”后，新的修订应携带更新后的用户信息。</li>
            <li>在 Vue 状态更新过程中，控制台不应出现 <code>Applying a mismatched transaction</code>。</li>
          </ol>

          <div class="panel-title">当前 HTML</div>
          <pre class="output">{{ htmlOutput }}</pre>
        </aside>
      </main>
    </div>
  `,
}).mount('#app')
