# link-tools

UTM tags and short links in posted captions. Ticket: pulbyte/notionsocial-backend#82.

```
api       decodeLinkSettings(doc) -> LinkSettings (notion_dbs.link_tools; throws on a bad shape)
          linkToolsFor(settings, pageUtm) -> LinkTools | undefined (Page values win)
          linkTargets(texts, platforms, utm) -> tagged links to shorten
          withLinkTools(text, platform, tools) · addUtm(url, utm, platform)
renders   _post.ts fit(): every caption, plus Facebook and GMB CTA links
switch    callers read config/cutover."link-tools" and set config.linkTools; unset = no change
stored    notion_dbs.link_tools {utm: {source, medium, campaign}, shorten} (DB settings)
writes    nothing; the Notion page keeps the original link
```
