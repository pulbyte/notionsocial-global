# platform-spec

What each platform accepts: text, media count, file types, bytes, first comment (#33).

```
api       PLATFORM_SPEC · spec(platform) · platformSpecJson() for the app · SPEC_PLATFORMS
source    values the code enforces today (survey on #33); spec.test.ts pins them
next      publishers, post-process and pre-flight read from here (one platform at a time);
          error catalogue (code -> cause -> fix -> link) in the same module
drift     9 known disagreements listed on #33; each needs a decision before it is unified
```
