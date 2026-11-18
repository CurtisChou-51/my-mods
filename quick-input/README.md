# Quick input

Saves the phrases you type over and over, and drops one into the prompt box with
a single press instead of you typing it again.

A bar sits above the prompt from the session's start. Up to ten phrases sit on
the left, as many as fit the bar's width whole, with a dim `+n` for the rest; `Manage` and `Hide` are pushed to the right edge, away from them.
Press a phrase and it goes in at the cursor, leaving you one Enter from sending
it. The mod registers no slash command, so nothing of it shows in the command
menu.

`Manage` opens the pane, which holds every phrase. The Add field is at the top:
type a phrase, press Enter, and it joins the list below. Each row has two fields,
Button and Inserts: the bar's button reads the first (`指的是`) and a press
inserts the second (`指的是什麼？`). Edit either, then press Enter or a field's
`✓`, and both are saved together; an empty Button falls back to the phrase, an
empty Inserts is refused. After the fields, `↑` moves a row up (the top ten are
the ones the bar can show) and `✕` deletes it. The list is kept across sessions.

`Hide` folds the bar down to one `Quick ▸` control, which brings it back.

Phrases are drawn as the app's primary button, so they stand apart from the
page; `Manage`, `Hide` and `Quick ▸` keep the default one. A mod picks a button's
variant, not its paint: the colour and the corners are the theme's.
