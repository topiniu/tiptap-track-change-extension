# TrackChangeExtension

A Track Change Extension for Tiptap. Like the revision in Microsoft Office Word.

## Demo

[Visit Demo](https://track-change.onrender.com/)

The demo is deployed on [render.com](https://www.render.com). You maybe need a VPN if you are in china

## Installation

Install from npm or copy `src/index.ts` into your project. This package targets `@tiptap/core@3.18.0` and `@tiptap/pm@3.18.0`.

## Usage in Vue3 with Tiptap 3

```javascript

import TrackChangeExtension from 'index.ts'
or
import TrackChangeExtension from 'track-change-extension'

const myTrackChangeEnabled = ref(false)

extensions: [
  ...OtherTiptapExtensions,
  TrackChangeExtension.configure({
    enabled: true,
    dataOpUserId: '', // set the op userId
    dataOpUserNickname: '', // set the op user nickname
    onStatusChange (status: boolean) {
      myTrackChangeEnabled = status
    }
  }),
]

// commands

// accept one change near by the cursor or an active selection range
editor.commands.acceptChange()
editor.commands.acceptAllChanges()
editor.commands.rejectChange()
editor.commands.rejectAllChanges()
editor.commands.updateOpUserOption('id', 'nickname')

```

## style

```css
insert {
  color: green;
  text-decoration: underline;
}
delete {
  color: red;
  text-decoration: line-through;
}
```

###### Enjoy it...

### publish
npm run build

npm publish --registry=https://registry.npmjs.org
