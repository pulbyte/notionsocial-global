# media-links

Media from what users paste: Drive folders, Canva links, embeds, PDFs. Ticket: pulbyte/notionsocial-backend#65.

```
api       mediaFromLink(url, {get, fromUrl, driveApiKey}) -> Media[]
            Drive folder -> its images, videos and PDFs by name (API with key, else the folder page)
            Canva share or canva.link -> the design image from Canva's oEmbed
            other links -> fromUrl(url); a Drive or Canva link with no file throws MediaLinkError
          withPdfPages(media, processed_media, bucket) -> each PDF followed by "<refId>~p<n>" pages
errors    MediaLinkError {errorCode: drive-restricted | canva-link, message: catalogue text}
switch    callers read config/cutover."media-extraction" and set config.mediaLinks
writes    nothing; post-process stores the PDF pages
```
