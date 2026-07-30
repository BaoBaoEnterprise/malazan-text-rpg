# Finishing the repo setup (run this on your own machine)

This folder is a ready-to-go starter for the private `wedding-music` repo.
The remote Claude session couldn't create the repo itself (its GitHub access
doesn't include repo creation), so the last step happens on your machine.

## Option A — with the gh CLI

From inside the folder you want to publish (this one, or your original
wedding-music folder — copy `CONTRIBUTING.md` and `.gitignore` in first):

```
git init -b main
git add .
git commit -m "Initial commit: wedding music planning files"
gh repo create wedding-music --private --source=. --push
```

If `gh` says it isn't installed, install it from https://cli.github.com.
If it says you aren't logged in, run `gh auth login` and follow the prompts.

## Option B — without gh

1. Go to https://github.com/new, name the repo `wedding-music`, set it to
   **Private**, and create it **without** a README.
2. Then, from inside the folder:

```
git init -b main
git add .
git commit -m "Initial commit: wedding music planning files"
git remote add origin https://github.com/YOUR-USERNAME/wedding-music.git
git push -u origin main
```

## Don't forget

A private repo is invisible to everyone but you until you invite them:
repo page → **Settings** → **Collaborators** → **Add people** → your
fiancé's GitHub username. Then they can clone it with:

```
git clone https://github.com/YOUR-USERNAME/wedding-music.git
```

Once the repo exists, delete this file — it's scaffolding, not content.
