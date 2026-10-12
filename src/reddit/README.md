# reddit

Reddit posts from a Page (#77): what kind of post it is, the subreddit's rules, Reddit's errors.

```
api       redditPageFields(decodeReddit.page(properties)) -> {subreddit, flair}: "Reddit - Subreddit",
          "Reddit - Flair"
          subredditName("r/foo" | URL | "u/me") -> "foo" | "u_me"
          planRedditPost({title, text, media, poster}) -> self | link | image | gallery | video
          checkRules(plan, {requirements, about, flairs}, flair) -> flair to send, or a failure
          submitFailure(json.errors) -> catalogue code + Reddit's message
          redditErrorText(failure) · decodeReddit.<answer>(data) (throws on a bad shape)
errors    catalogue codes reddit-* in platform-spec (fault user, except rate limit)
switch    callers read config/cutover."reddit"
writes    nothing; functions publish/reddit.ts calls the API
```
