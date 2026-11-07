import {contentTypeOrExt} from "../src/_url";

const jpg = "https://prod-files-secure.s3.us-west-2.amazonaws.com/a/b/carousel_01.jpg?X-Amz-Signature=x";

test("a generic binary header takes the type from the extension", () => {
  expect(contentTypeOrExt("binary/octet-stream", jpg)).toBe("image/jpeg");
  expect(contentTypeOrExt("application/octet-stream", jpg)).toBe("image/jpeg");
  expect(contentTypeOrExt(undefined, jpg)).toBe("image/jpeg");
  expect(contentTypeOrExt("image", jpg)).toBe("image/jpeg");
});

test("a real header is kept", () => {
  expect(contentTypeOrExt("image/png", jpg)).toBe("image/png");
});

test("no extension keeps the header", () => {
  expect(contentTypeOrExt("binary/octet-stream", "https://x/y/noext")).toBe("binary/octet-stream");
});
