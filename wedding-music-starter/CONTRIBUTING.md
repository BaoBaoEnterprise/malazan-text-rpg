# How we edit these files (no git experience needed)

This folder is shared through GitHub, which is basically a shared folder with
a "save history" — every change is recorded, and nothing is ever truly lost.
There are two ways to edit, and the phone-friendly one is by far the easiest.

## The easy way: edit on the GitHub website or app

If you're on your phone or just want to make a quick edit:

1. Open the repo on github.com (or in the GitHub mobile app) and tap the file
   you want to change.
2. Tap the **pencil icon** to edit.
3. Make your changes, then tap **Commit changes** (that's GitHub's word for
   "save"). You can add a short note about what you changed, or just accept
   the default.

That's it. The website handles all the syncing for you — you can skip the
rest of this document.

## The other way: editing on a computer with git

If the folder is cloned onto your computer and you edit files in a text
editor, there are three habits to learn. Think of it like a shared notebook
only one person should write in at a time:

**1. Pull before you edit.** This downloads the latest version so you're not
editing an outdated copy. In a terminal, inside the folder:

```
git pull
```

**2. Commit after you edit.** This saves a snapshot of your changes with a
note about what you did:

```
git add -A
git commit -m "added three songs to the must-play list"
```

**3. Push when you're done.** This uploads your snapshot so the other person
can see it:

```
git push
```

The full routine every time: **pull → edit → commit → push.** Don't leave
edits sitting on your computer unpushed — that's how conflicts happen.

## If you see a "conflict"

A conflict just means we both edited the same lines before syncing. Git
doesn't know whose version to keep, so it puts **both versions in the file**,
separated by strange marker lines that look like this:

```
<<<<<<<
your version of the line
=======
my version of the line
>>>>>>>
```

To fix it:

1. Open the file and find the markers.
2. Decide which lines to keep (or keep both — it's a song list, more songs is
   fine!).
3. Delete the three marker lines (`<<<<<<<`, `=======`, `>>>>>>>`) and the
   version you don't want.
4. Save, then commit and push as usual:

```
git add -A
git commit -m "fixed conflict in must-play list"
git push
```

If it looks scary, don't worry — nothing is lost, ever. Every version of
every file is saved in the history. Worst case, text the other of us and
we'll sort it out together.
