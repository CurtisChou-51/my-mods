/**
 * One saved phrase: `text` is what a press inserts, `short` (when set) is what
 * its button on the bar reads instead.
 */
export type Phrase = { id: string; text: string; short?: string }

/** A pane row's fields as typed, before a save writes them to the phrase. */
export type Edit = { short: string; text: string }

declare module 'claude-code' {
  interface PluginState {
    'quick-input': {
      phrases: Shaped<Phrase[]>
      isHidden: boolean
      draft: string
      edits: Record<string, Edit>
    }
  }
}
