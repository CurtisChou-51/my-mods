import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { Edit, Phrase } from '../types'

const PANE = 'quick-input'
const STORE_KEY = 'phrases'
const BAND_COUNT = 10
const LABEL_CHARS = 14
const SHORT_CELLS = 20
const INSERTS_CELLS = 30

/** Cells a button takes beyond its label, as drawn, and between two buttons. */
const BUTTON_CHROME = 4
const GAP = 1
/** Manage and Hide, with the gap between them and the room before them. */
const ACTIONS_CELLS = 6 + BUTTON_CHROME + GAP + 4 + BUTTON_CHROME + 2

const phrases = atom({ plugin: 'quick-input', key: 'phrases' } as const, [], {
  shape: 'phrase-1',
})
const isHidden = atom({ plugin: 'quick-input', key: 'isHidden' } as const, false)
const draft = atom({ plugin: 'quick-input', key: 'draft' } as const, '')
const edits = atom(
  { plugin: 'quick-input', key: 'edits' } as const,
  {} as Record<string, Edit>,
)

/** One line of a phrase, cut to fit a pill. */
const label = (text: string) => {
  const line = text.replace(/\s+/g, ' ').trim()
  const cut = [...line].slice(0, LABEL_CHARS).join('')

  return cut === line ? line : `${cut}…`
}

/** What a phrase's button reads: its own short label, else its text cut. */
const shown = (one: Phrase) => {
  const short = one.short?.trim() ?? ''

  return short === '' ? label(one.text) : label(short)
}

const WIDE =
  /[ᄀ-ᅟ⺀-〾ぁ-㏿㐀-䶿一-鿿ꀀ-꓏가-힣豈-﫿︰-﹏＀-｠￠-￦]/

/** How many cells a text takes, counting a CJK glyph as two. */
const cells = (text: string) =>
  [...text].reduce((n, ch) => n + (WIDE.test(ch) ? 2 : 1), 0)

/**
 * The phrases whose buttons fit in `columns` beside Manage and Hide, in order,
 * and how many were left off: a button that would not fit whole is not drawn.
 */
const fit = (list: Phrase[], columns: number) => {
  const room = columns - ACTIONS_CELLS
  const kept: Phrase[] = []
  let used = 0

  for (const [i, one] of list.entries()) {
    const width = cells(shown(one)) + BUTTON_CHROME + (kept.length > 0 ? GAP : 0)
    const rest = list.length - i - 1
    // Leave room for the `+n` that says how many are off the bar.
    const tail = rest > 0 ? GAP + cells(`+${rest}`) : 0
    if (used + width + tail > room) {
      break
    }
    kept.push(one)
    used += width
  }

  return { kept, left: list.length - kept.length }
}

/** An id no phrase in `list` holds, so a surface tells the new row apart. */
const nextId = (list: Phrase[]) => {
  const taken = list.map(one => Number(one.id.replace(/^p/, '')))
  const high = taken.reduce((a, b) => (Number.isFinite(b) && b > a ? b : a), 0)

  return `p${high + 1}`
}

const isPhrase = (one: unknown): one is Phrase =>
  typeof one === 'object' &&
  one !== null &&
  typeof (one as Phrase).id === 'string' &&
  typeof (one as Phrase).text === 'string' &&
  ((one as Phrase).short === undefined ||
    typeof (one as Phrase).short === 'string')

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const kept = await $.store.get(STORE_KEY)
    if (Array.isArray(kept)) {
      await update($, phrases, () => kept.filter(isPhrase))
    }

    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) {
      return next(e)
    }

    const { Box, Button, Text } = $.ui.resolve(e)

    // Hidden: one control is left, so the bar is always a press away.
    if (await read($, isHidden)) {
      return (
        <Box>
          <Button
            key="show"
            label="Quick ▸"
            onPress={() => update($, isHidden, () => false)}
          />
        </Box>
      )
    }

    const list = await read($, phrases)
    const { kept, left } = fit(list.slice(0, BAND_COUNT), e.props.bodyColumns)
    const off = left + Math.max(0, list.length - BAND_COUNT)

    return (
      <Box width="100%" justifyContent="space-between">
        <Box gap={GAP}>
          {kept.map(one => (
            <Button
              key={one.id}
              label={shown(one)}
              variant="primary"
              onPress={async () => {
                const filled = await $.prompt.fill({
                  text: one.text,
                  mode: 'insert',
                })
                if (!filled.isFilled) {
                  $.ui.toast(
                    'The prompt box could not take that phrase just now.',
                  )
                }
              }}
            />
          ))}
          {off > 0 && <Text dimColor>+{off}</Text>}
          {list.length === 0 && (
            <Text dimColor>No phrases yet — Manage adds one.</Text>
          )}
        </Box>
        <Box gap={1} flexShrink={0}>
          <Button
            key="manage"
            label="Manage"
            onPress={() => $.ui.open({ id: PANE, title: 'Quick input' })}
          />
          <Button
            key="hide"
            label="Hide"
            onPress={() => update($, isHidden, () => true)}
          />
        </Box>
      </Box>
    )
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Button, Input, Text } = $.ui.resolve(e)
    const list = await read($, phrases)
    const typed = await read($, draft)

    /** Writes a new list to the session's state and the store behind it. */
    const save = async (next: (old: Phrase[]) => Phrase[]) => {
      const written = next(await read($, phrases))
      await update($, phrases, () => written)
      await $.store.set(STORE_KEY, written)
    }

    const add = async (text: string) => {
      const clean = text.trim()
      if (clean === '') {
        return
      }
      await save(old => [...old, { id: nextId(old), text: clean }])
      await update($, draft, () => '')
    }

    const pending = await read($, edits)

    /** A row's fields: what was typed in them, else the phrase as saved. */
    const editOf = (all: Record<string, Edit>, one: Phrase): Edit =>
      all[one.id] ?? { short: one.short ?? '', text: one.text }

    const type = (one: Phrase, field: keyof Edit, value: string) =>
      update($, edits, all => ({
        ...all,
        [one.id]: { ...editOf(all, one), [field]: value },
      }))

    const forget = (id: string) =>
      update($, edits, all => {
        const { [id]: _, ...rest } = all

        return rest
      })

    /**
     * Writes both of a row's fields to its phrase at once; an empty button
     * label falls back to the phrase, an empty phrase is refused.
     */
    const commit = async (one: Phrase) => {
      const edit = editOf(await read($, edits), one)
      const text = edit.text.trim()
      if (text === '') {
        $.ui.toast('A phrase cannot be empty; it was left as it was.')

        return
      }
      const short = edit.short.trim()
      await save(old =>
        old.map(x =>
          x.id !== one.id
            ? x
            : short === ''
              ? { id: x.id, text }
              : { id: x.id, text, short },
        ),
      )
      await forget(one.id)
    }

    /** Enter (or the field's ✓) in either field saves the row. */
    const submit = async (one: Phrase, field: keyof Edit, value: string) => {
      await type(one, field, value)
      await commit(one)
    }

    const swapUp = (i: number) =>
      save(old => {
        const one = old[i]
        const above = old[i - 1]
        if (i === 0 || one === undefined || above === undefined) {
          return old
        }

        return [...old.slice(0, i - 1), one, above, ...old.slice(i + 1)]
      })

    return (
      <Box flexDirection="column" paddingTop={1} paddingX={1}>
        <Input
          key="add"
          label="Add"
          value={typed}
          submitLabel="add"
          onInput={value => update($, draft, () => value)}
          onSubmit={value => void add(value)}
        />
        <Box marginTop={2} flexDirection="column" gap={1}>
          {list.length > 0 && (
            <Box gap={1}>
              <Box width={2} />
              <Box width={SHORT_CELLS} marginRight={1}>
                <Text dimColor>Button</Text>
              </Box>
              <Text dimColor>Inserts</Text>
            </Box>
          )}
          {list.length === 0 && (
            <Text dimColor>
              No phrases yet. The first {BAND_COUNT} you add get a pill above
              the prompt.
            </Text>
          )}
          {list.map((one, i) => {
            const edit = editOf(pending, one)

            return (
              <Box key={one.id} gap={1}>
                <Box width={2}>
                  <Text dimColor>{i < BAND_COUNT ? `${i + 1}` : '·'}</Text>
                </Box>
                <Box width={SHORT_CELLS} marginRight={1}>
                  <Input
                    key={`short-${one.id}`}
                    value={edit.short}
                    placeholder={label(one.text)}
                    submitLabel="✓"
                    onInput={value => void type(one, 'short', value)}
                    onSubmit={value => void submit(one, 'short', value)}
                  />
                </Box>
                <Box width={INSERTS_CELLS}>
                  <Input
                    key={`text-${one.id}`}
                    value={edit.text}
                    submitLabel="✓"
                    onInput={value => void type(one, 'text', value)}
                    onSubmit={value => void submit(one, 'text', value)}
                  />
                </Box>
                <Box gap={0}>
                  <Button
                    key={`up-${one.id}`}
                    label="↑"
                    plain
                    dimColor
                    onPress={() => swapUp(i)}
                  />
                  <Button
                    key={`del-${one.id}`}
                    label="✕"
                    plain
                    dimColor
                    onPress={async () => {
                      await save(old => old.filter(x => x.id !== one.id))
                      await forget(one.id)
                    }}
                  />
                </Box>
              </Box>
            )
          })}
        </Box>
      </Box>
    )
  })
}
