# TrackChangeExtension

A track change extension for Tiptap, similar to revision mode in Microsoft Word.

This fork has been migrated to `Tiptap 3.18.0`.

## Status

- Tiptap version: `@tiptap/core@3.18.0`
- ProseMirror bridge: `@tiptap/pm@3.18.0`
- Demo: local Vite demo included in this repository

## Installation

Install this package or copy `src/index.ts` into your own project.

Peer dependencies:

```bash
npm install @tiptap/core@3.18.0 @tiptap/pm@3.18.0
```

If you want to run this fork locally:

```bash
npm install
```

## Usage

```ts
import TrackChangeExtension from 'track-change-extension'

const editor = new Editor({
  extensions: [
    StarterKit,
    TrackChangeExtension.configure({
      enabled: true,
      dataOpUserId: 'u-1001',
      dataOpUserNickname: 'Alice',
      onStatusChange(status: boolean) {
        console.log('track change:', status)
      },
    }),
  ],
})
```

## Commands

```ts
editor.commands.setTrackChangeStatus(true)
editor.commands.getTrackChangeStatus()
editor.commands.toggleTrackChangeStatus()

editor.commands.acceptChange()
editor.commands.acceptAllChanges()
editor.commands.rejectChange()
editor.commands.rejectAllChanges()

editor.commands.updateOpUserOption('u-1001', 'Alice')
```

## Styling

The extension renders tracked content with `insert` and `delete` tags.

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

## Local Demo

This repository includes a minimal demo built with Vite and `@tiptap/starter-kit`.

Start the demo locally:

```bash
npm run demo
```

Demo source files:

- `demo/index.html`
- `demo/main.js`
- `demo/styles.css`

What you can verify in the demo:

- insert text while track change is enabled
- delete normal text and see it preserved as a deletion mark
- delete newly inserted text and see it removed directly
- replace a selection and inspect both insertion and deletion marks
- accept or reject the current change or all changes

## Build

```bash
npm run build
```

## Publish

```bash
npm publish --registry=https://registry.npmjs.org
```
