# caption

Text rules for captions (pulbyte/notionsocial-backend#63). The renderer stays in parser.ts,
_richtext.ts and _post.ts; it calls this module when `FormattingOptions.captionFixes` is on.

```
api       plainText · fitText · isDashLine · splitOnDashLines · indentSoftBreaks · linkToUrl
          formattingFrom(db, user): database formatting_options win over the account's
switch    captionFixes <- backend config/cutover."caption-fixes" (old false, next true)
option    disableTextFormatting: per database, works without the switch
golden    golden.test.ts renders golden/fixtures.ts for every Platform into golden/out/*.txt;
          a diff there is a change in what users post. Update on purpose: npx vitest -u
bugs      bugs.test.ts: one fixture per #63 bug, old and fixed output side by side
```
