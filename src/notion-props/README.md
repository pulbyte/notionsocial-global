# notion-props

Mapped Notion properties by id as well as name (#38).

```
api       healProps(props, meta, schema) -> {props, meta, renamed, missing, changed} (pure)
          statusFilterType(meta) -> "status" | "select"
stored    notion_dbs.props (role -> name) · notion_dbs.props_meta (role -> {id, type})
used by   schedule scan: native Status filter; on a validation error, heal renames then retry
```
