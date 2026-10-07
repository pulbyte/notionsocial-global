// Error catalogue (#33): each publish error users can see, with its cause, fix and fault.
// Messages are the exact texts functions/src/lib/text.ts used on 2026-10-05; web is the site URL.
export type ErrorFault = "user" | "platform" | "notionsocial";

export type CatalogueEntry = {
  platform: string; // "*" = any platform
  fault: ErrorFault;
  cause: string;
  fix: string;
  message: (web: string) => string;
};

export const ERROR_CATALOGUE = {
  "ig-not-business": {platform: "instagram", fault: "user", cause: "The Instagram account is a personal account.", fix: "Switch it to a Business account and reconnect with all permissions.", message: () => `Please switch your Instagram account to a Business account: https://help.instagram.com/502981923235522, And try agian by granting all the permissions, If you still face this issue, Please contact support.`},
  "image-too-big": {platform: "*", fault: "user", cause: "An image is over the 5 MB limit.", fix: "Upload a smaller image (JPG is usually smaller than PNG).", message: () => `Image size exceeds limit. Please upload an image under 5 MB.`},
  "threads-image-too-big": {platform: "threads", fault: "user", cause: "An image is over Threads' 5 MB limit; Notion previews hide the real size.", fix: "Convert to JPG or re-export smaller, then reschedule.", message: () => `Your image is over Threads' 5 MB limit. Notion shows a resized preview so the file looks small but can still be 4-8 MB (especially for PNGs from ChatGPT or screenshots). Convert the image from PNG to JPG before uploading to Notion (cuts ~70% without visible loss), or re-export at a lower resolution, then clear the Notionsocial property and set Status back to schedule again.`},
  "ig-server": {platform: "instagram", fault: "platform", cause: "Instagram returned a server error.", fix: "Retry later; check the video against Instagram's specs.", message: (web) => `Instagram is experiencing some server issues at the moment: Please try again later and verify that your video meets the requirements: ${web}/ig-specs`},
  "ig-no-media": {platform: "instagram", fault: "user", cause: "Instagram needs an image or a video.", fix: "Add a JPG image or an MP4 video.", message: () => `No media to post; Please upload an image (JPG) or a video (mp4).`},
  "ig-video-with-image": {platform: "instagram", fault: "user", cause: "One video plus one image was treated as a feed post.", fix: "Follow the reel guide to post the video as a reel.", message: (web) => `If you were looking to post the video as a reel, Please follow this guide: ${web}/ig-reel`},
  "ig-video-specs": {platform: "instagram", fault: "user", cause: "The video does not meet Instagram's format or length rules.", fix: "Use MP4/MOV, at least 3 seconds.", message: (web) => `Please use MP4 or MOV format only. Video must be atleast 3 seconds long. \nIf you were looking to post the video as a reel, Please follow this guide: ${web}/ig-reel`},
  "ig-reel-plan": {platform: "instagram", fault: "user", cause: "Reels need a paid plan.", fix: "Upgrade to a paid plan.", message: (web) => `Posting a reel is not available for free users. Please upgrade to a paid plan ${web}/pricing.`},
  "ig-video-plan": {platform: "instagram", fault: "user", cause: "Feed videos must be posted as reels, which need a paid plan.", fix: "Upgrade and post the video as a reel.", message: () => `Instagram API no longer supports the posting of a feed video. To post your videos, consider using the Reel feature. Upgrade to a paid billing plan on Notionsocial to unlock this functionality.`},
  "video-too-short": {platform: "*", fault: "user", cause: "The video is shorter than 3 seconds.", fix: "Use a video longer than 3 seconds.", message: (web) => `Your video should have a duration of more than 3 seconds.\nIf you were looking to post the video as a reel, Please follow this guide: ${web}/ig-reel`},
  "reel-no-video": {platform: "instagram", fault: "user", cause: "Reel was chosen but no video was uploaded.", fix: "Upload an MP4 video.", message: () => `You selected to post a reel, but haven't uploaded a video (mp4). Please upload a video and try again.`},
  "video-specs": {platform: "*", fault: "user", cause: "The video did not finish processing or does not meet the specs.", fix: "Schedule at least 10 minutes ahead, or adjust the video to the specs.", message: (web) => `Always set a time to schedule the post (Atleast 10 minutes in future), to allow for video processing, Or check specs and modify the video to meet the requirements at ${web}/media-specs.`},
  "fb-group-app": {platform: "facebook", fault: "user", cause: "The group has not added the NotionSocial app.", fix: "Ask the group admin to add the app.", message: () => `To post in this group, Kindly verify that the group admin has added Notionsocial into the group apps. Learn more: https://www.facebook.com/help/261149227954100.`},
  "x-no-text": {platform: "x", fault: "user", cause: "The post has no text.", fix: "Write the post text in the page.", message: () => `Missing text content, Please enter your post's content as text inside the Notion page.`},
  "li-media-type": {platform: "linkedin", fault: "user", cause: "The media type is not supported by LinkedIn.", fix: "Use JPG/PNG/GIF, MP4, or PDF/DOC/PPT.", message: () => `Unsupported media format, Please upload JPG, PNG, GIF for images, MP4 for videos, and PDF, DOC, PPT for documents.`},
  "tt-no-video": {platform: "tiktok", fault: "user", cause: "TikTok needs a video.", fix: "Upload an MP4, WEBM or MOV video.", message: () => `No video to post; Please upload a video file in MP4/WEBM/MOV format.`},
  "fb-server": {platform: "facebook", fault: "platform", cause: "Facebook returned a server error.", fix: "Retry later; check the media against the specs.", message: () => `Facebook server error, Please try again later and make sure your media meets the specifications.`},
  "x-media-specs": {platform: "x", fault: "user", cause: "The media does not meet X's specs.", fix: "Keep video under 140 seconds and within X's specs.", message: () => `Issue with media sepcs, Please make sure your video is under 140 seconds and check all the specs at https://pulkitsaini.notion.site/Twitter-Media-Specifications-c2f08fd367b14f5f9ca896dffa88986d?pvs=4.`},
  "x-daily-limit": {platform: "x", fault: "platform", cause: "X allows 100 posts per 24 hours per account through the API.", fix: "Wait and reschedule.", message: () => `You have exceeded the 100 posts per 24 hour limit for this X account. Please try again after some time.`},
  "x-too-long": {platform: "x", fault: "user", cause: "The post is over 280 characters.", fix: "Shorten it, or use X Premium with the long-post option.", message: (web) => `Post exceeds the 280 character limit. Please subscribe to X Premium to post longer tweets, Or divide the tweet into multiple thread posts.\nIf you're already subscribed to X Premium, Please enable long tweets -> ${web}/blog/long-tweets.`},
  "x-mentions-blocked": {platform: "x", fault: "platform", cause: "X restricts @mentions and quotes from API posts.", fix: "Remove the mention or quote.", message: () => `X now restricts @mentions and quotes in posts made via their API to reduce spam. Please remove @mentions from your post and try again.`},
  "x-quote-blocked": {platform: "x", fault: "platform", cause: "The quoted post's author blocks quotes.", fix: "Remove the quote.", message: () => `X (Twitter) blocked the quote because the post's author restricts who can quote them. This is an author privacy setting, not a NotionSocial issue. Workaround: paste the post URL in your caption for auto-embed, or reply to the post instead of quoting.`},
  "ig-caption-too-long": {platform: "instagram", fault: "user", cause: "The caption is over 2200 characters.", fix: "Shorten the caption.", message: (web) => `Instagram caption limit exceeded (2200 characters). Please shorten your caption or consider moving excess content to the first comment, Learn more: ${web}/blog/first-comments`},
  "threads-server": {platform: "threads", fault: "platform", cause: "Threads returned a server error.", fix: "Retry later; check the media against the specs.", message: () => `Threads server error. Please try again later and make sure your media specs meet the requirements, https://developers.facebook.com/docs/threads/overview/#limitations`},
  "threads-media-type": {platform: "threads", fault: "user", cause: "The media file type is not supported by Threads.", fix: "Use a supported image or video format.", message: () => `The uploaded media file is not supported by Threads. Please upload only JPEG, PNG or MP4 format. Also for videos, check full specifications (width, bitrate, etc.) at https://developers.facebook.com/docs/threads/overview/#limitations`},
  "threads-video-too-long": {platform: "threads", fault: "user", cause: "The video is longer than 5 minutes.", fix: "Trim the video to 5 minutes or less.", message: () => `Threads does not support videos larger than 5 minutes. Please check the duration of your video and try again.`},
  "threads-no-content": {platform: "threads", fault: "user", cause: "The post has no text or media.", fix: "Add text or media.", message: () => `Nothing to post!, Please write the content for the thread in the Notion page or upload a media file and try again.`},
  "ig-app-mismatch": {platform: "instagram", fault: "user", cause: "The account was connected through the old Instagram app.", fix: "Remove it and reconnect with 'Connect Instagram'.", message: () => `Please remove this Instagram account on notionsocial.app/app, and reconnect it using the new "Connect Instagram" option, This is needed due to a recent Instagram API update, Which is causing issues with the previous login method (Facebook login).`},
  "account-not-connected": {platform: "*", fault: "user", cause: "The social account is not connected.", fix: "Connect it in NotionSocial.", message: () => `Social account is not connected to your Notionsocial account, Please login with the same account you used to connect your account.`},
  // #108: texts users saw in the last 60 days with no entry (2026-10-07). Messages are the exact texts.
  "tt-video-dimensions": {platform: "tiktok", fault: "user", cause: "TikTok accepts videos 360-4096 px on both sides.", fix: "Export the video within 360-4096 px, then reschedule.", message: () => `Invalid media dimensions. Videos must be between 360px and 4096px for both height and width.`},
  "yt-upload-limit": {platform: "youtube", fault: "platform", cause: "YouTube caps daily uploads per channel (lower for unverified channels).", fix: "Wait 24 hours, or verify the channel to raise the cap.", message: () => `The user has exceeded the number of videos they may upload.`},
  "fb-login-checkpoint": {platform: "facebook", fault: "user", cause: "Facebook put a security checkpoint on the account.", fix: "Log in at facebook.com, follow the steps, then reschedule.", message: () => `You cannot access the app till you log in to www.facebook.com and follow the instructions given.`},
  "account-expired": {platform: "*", fault: "user", cause: "The platform no longer accepts the account's access token (expired, revoked or password changed).", fix: "Refresh the account in NotionSocial, then reschedule.", message: () => `Social account got disconnected, Please refresh it in Notionsocial.`},
  "account-locked": {platform: "*", fault: "user", cause: "The account is over the plan's account limit and was locked.", fix: "Upgrade, or remove other accounts to unlock it.", message: () => `Max social account limit reached`},
  "pin-no-board": {platform: "pinterest", fault: "user", cause: "No Pinterest board was selected.", fix: "Select a board in 'Pinterest - Board' and refresh boards in NotionSocial.", message: (web) => `Please select the Pinterest board to add your pin to in the "Pinterest - Board" property and refresh your boards in Notionsocial to update the list. Learn more: ${web}/pinterest-board`},
  "pin-video-cover": {platform: "pinterest", fault: "user", cause: "A Pinterest video needs a cover image.", fix: "Add a JPG or PNG cover image to the media.", message: () => `Please also upload a cover image (jpeg, jpg, png) for the video in the media property.`},
  "yt-no-video": {platform: "youtube", fault: "user", cause: "YouTube needs a video file.", fix: "Upload a video (MP4, MOV, AVI, WMV, FLV, 3GPP, WebM).", message: () => `No supported video found. Please upload a video file (MP4, MOV, AVI, WMV, FLV, 3GPP, WebM)`},
  "yt-thumbnail-unverified": {platform: "youtube", fault: "user", cause: "Custom thumbnails need a verified YouTube channel.", fix: "Verify the channel, or post without a thumbnail.", message: () => `To upload a thumbnail for your video, Please ensure that your YouTube channel is verified, Learn more: https://support.google.com/youtube/answer/171664.`},
} satisfies Record<string, CatalogueEntry>;

export type ErrorCode = keyof typeof ERROR_CATALOGUE;

export type Explained = {code: ErrorCode; platform: string; fault: ErrorFault; cause: string; fix: string; message: string};

export function explain(code: ErrorCode, web = "https://notionsocial.app"): Explained {
  const e: CatalogueEntry = ERROR_CATALOGUE[code];

  return {code, platform: e.platform, fault: e.fault, cause: e.cause, fix: e.fix, message: e.message(web)};
}

// The catalogue code a stored error text came from (#33): the longest catalogue message found
// inside it, since publishers prefix some messages ("Video specs error: ..."). undefined = raw
// platform text with no catalogue entry yet.
export function codeForMessage(text: string | undefined, web = "https://notionsocial.app"): ErrorCode | undefined {
  if (!text) return undefined;
  let best: {code: ErrorCode; length: number} | undefined;

  // SAFETY: Object.keys of ERROR_CATALOGUE are exactly its ErrorCode keys.
  for (const code of Object.keys(ERROR_CATALOGUE) as ErrorCode[]) {
    const message = explain(code, web).message;

    if (text.includes(message) && message.length > (best?.length ?? 0)) best = {code, length: message.length};
  }

  return best?.code;
}
