# platform-spec

What each platform accepts: text, media count, file types, bytes, first comment, hashtags (#33).

```
api       PLATFORM_SPEC · spec(platform) · platformSpecJson() for the app · SPEC_PLATFORMS
          PLAN_SPEC: per-plan image/video MB and X threads, as the plan table shows them
source    values the code enforces today (survey on #33); spec.test.ts pins them
          hashtags: Instagram API cap of 30, read by pre-flight (#50)
          video length, story and carousel frames: what post-process fits media to (#62)
errors    explain(code): cause, fix, message, link (guide, else /help/errors#code), ref (outside URL)
next      publishers, post-process and pre-flight read from here (one platform at a time);
          error catalogue (code -> cause -> fix -> link) in the same module
drift     decided 2026-10-12 (#108): the spec records what production does today;
          Bluesky grapheme counting (drift 9) is a follow-up
```
