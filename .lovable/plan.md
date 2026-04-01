

# Plan: Merge Browse Sounds into Explore + Add Token Image Upload

## What changes

### 1. Merge Browse Sounds into Explore as a third tab

The Explore page currently has two tabs: **Tokens** and **Clips**. The entire Browse Sounds page will become a third tab called **Browse & Mint** on the Explore page.

- **New tab on Explore page**: Add `🎧 Browse & Mint` tab containing all the Browse Sounds functionality (search, category filter, sound grid, pagination, LiveActivityFeed sidebar, MintSoundModal)
- **Extract Browse content into component**: Create `src/components/explore/BrowseMintTab.tsx` — move all logic from `BrowseSoundsPage` (wallet hooks, minting flow, reservation, sound browser state) into this new tab component
- **Remove `/browse` route**: Delete the route from `App.tsx`, add a redirect from `/browse` to `/explore?tab=browse`
- **Delete `src/pages/BrowseSounds.tsx`**: No longer needed
- **Update navigation**: Remove "Browse Sounds" from `AppSidebar.tsx` and `MobileTabBar.tsx` — the Explore entry now covers everything

### 2. Add cover image upload to MintSoundModal

When minting a MyInstants sound, users currently have no way to add a token image. The mint form will get an image upload field.

- **Add image file state** to `MintSoundModal`: new `imageFile` state + file input with preview
- **Update modal props**: Add `onSubmitMint` to accept an optional `File | null` image parameter
- **Update `handleSubmitMint` in BrowseMintTab**: Pass the image file to `uploadTokenMetadata()` so it gets uploaded to IPFS and included in the token's on-chain metadata
- **Save `cover_image_url`** to the tokens table via the `manage-user-data` edge function call, so the image displays on Explore/Tokens and Trade pages

### 3. Route and navigation cleanup

- `/browse` redirects to `/explore?tab=browse`
- Sidebar: single "Explore" entry (Compass icon) replaces both Explore + Browse Sounds
- Mobile tab bar: remove Browse tab, keep Explore

## Technical details

**Files to create:**
- `src/components/explore/BrowseMintTab.tsx` — extracted from BrowseSoundsPage with all minting logic

**Files to modify:**
- `src/pages/Explore.tsx` — add third tab, import BrowseMintTab, handle `?tab=browse` param
- `src/components/browse/MintSoundModal.tsx` — add image file input with drag-drop/click-to-upload and preview thumbnail
- `src/App.tsx` — replace `/browse` route with redirect to `/explore?tab=browse`
- `src/components/AppSidebar.tsx` — remove Browse Sounds nav item
- `src/components/MobileTabBar.tsx` — remove Browse tab

**Files to delete:**
- `src/pages/BrowseSounds.tsx`

