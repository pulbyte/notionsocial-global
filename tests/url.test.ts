import {MediaFile, TransformedMedia} from "types";
import {getMediaRef, makeMediaPostReady} from "../src/_media";
import {isGiphyLink, alterGiphyLink, extractGoogleDriveFileId} from "../src/_url";
import {downloadFromUrl} from "../src/file";

describe("Google Drive URL Functions", () => {
  describe("extractGoogleDriveFileId", () => {
    it("should extract file ID from standard file view URL", () => {
      const url = "https://drive.google.com/file/d/1ABCdefGHIjklMNOpqrsTUVwxYZ/view";
      expect(extractGoogleDriveFileId(url)).toBe("1ABCdefGHIjklMNOpqrsTUVwxYZ");
    });

    it("should extract file ID from file view URL with query parameters", () => {
      const url =
        "https://drive.google.com/file/d/1ABCdefGHIjklMNOpqrsTUVwxYZ/view?usp=sharing";
      expect(extractGoogleDriveFileId(url)).toBe("1ABCdefGHIjklMNOpqrsTUVwxYZ");
    });

    it("should extract file ID from file edit URL", () => {
      const url = "https://drive.google.com/file/d/1ABCdefGHIjklMNOpqrsTUVwxYZ/edit";
      expect(extractGoogleDriveFileId(url)).toBe("1ABCdefGHIjklMNOpqrsTUVwxYZ");
    });

    it("should extract file ID from open URL with ID parameter", () => {
      const url = "https://drive.google.com/open?id=1ABCdefGHIjklMNOpqrsTUVwxYZ";
      expect(extractGoogleDriveFileId(url)).toBe("1ABCdefGHIjklMNOpqrsTUVwxYZ");
    });

    it("should extract file ID from UC download URL", () => {
      const url = "https://drive.google.com/uc?id=1ABCdefGHIjklMNOpqrsTUVwxYZ";
      expect(extractGoogleDriveFileId(url)).toBe("1ABCdefGHIjklMNOpqrsTUVwxYZ");
    });

    it("should extract file ID from UC export download URL", () => {
      const url = "https://drive.google.com/uc?export=download&id=1ABCdefGHIjklMNOpqrsTUVwxYZ";
      expect(extractGoogleDriveFileId(url)).toBe("1ABCdefGHIjklMNOpqrsTUVwxYZ");
    });

    it("should extract file ID from drive usercontent download URL", () => {
      const url =
        "https://drive.usercontent.google.com/download?id=1ABCdefGHIjklMNOpqrsTUVwxYZ&confirm=xxx";
      expect(extractGoogleDriveFileId(url)).toBe("1ABCdefGHIjklMNOpqrsTUVwxYZ");
    });

    it("should extract file ID from Google Docs document URL", () => {
      const url = "https://docs.google.com/document/d/1ABCdefGHIjklMNOpqrsTUVwxYZ/edit";
      expect(extractGoogleDriveFileId(url)).toBe("1ABCdefGHIjklMNOpqrsTUVwxYZ");
    });

    it("should extract file ID from Google Sheets spreadsheet URL", () => {
      const url =
        "https://docs.google.com/spreadsheets/d/1ABCdefGHIjklMNOpqrsTUVwxYZ/edit#gid=0";
      expect(extractGoogleDriveFileId(url)).toBe("1ABCdefGHIjklMNOpqrsTUVwxYZ");
    });

    it("should extract file ID from Google Slides presentation URL", () => {
      const url =
        "https://docs.google.com/presentation/d/1ABCdefGHIjklMNOpqrsTUVwxYZ/edit#slide=id.p";
      expect(extractGoogleDriveFileId(url)).toBe("1ABCdefGHIjklMNOpqrsTUVwxYZ");
    });

    it("should extract file ID from drive document URL", () => {
      const url = "https://drive.google.com/document/d/1ABCdefGHIjklMNOpqrsTUVwxYZ/edit";
      expect(extractGoogleDriveFileId(url)).toBe("1ABCdefGHIjklMNOpqrsTUVwxYZ");
    });

    it("should handle file IDs with hyphens and underscores", () => {
      const url = "https://drive.google.com/file/d/1_ABC-def_GHI-jkl/view";
      expect(extractGoogleDriveFileId(url)).toBe("1_ABC-def_GHI-jkl");
    });

    it("should extract file ID from altered UC export download URL", () => {
      const url = "https://drive.google.com/uc?export=download&id=1z50hYszT3MhurBB5Y-vfey5frCOgWBTr";
      expect(extractGoogleDriveFileId(url)).toBe("1z50hYszT3MhurBB5Y-vfey5frCOgWBTr");
    });

    it("should extract file ID from altered drive usercontent URL with confirm parameter", () => {
      const url = "https://drive.usercontent.google.com/download?id=1z50hYszT3MhurBB5Y-vfey5frCOgWBTr&confirm=xxx";
      expect(extractGoogleDriveFileId(url)).toBe("1z50hYszT3MhurBB5Y-vfey5frCOgWBTr");
    });

    it("should extract file ID from Google Drive API URL", () => {
      const url = "https://www.googleapis.com/drive/v3/files/1z50hYszT3MhurBB5Y-vfey5frCOgWBTr?alt=media&key=YOUR_API_KEY";
      expect(extractGoogleDriveFileId(url)).toBe("1z50hYszT3MhurBB5Y-vfey5frCOgWBTr");
    });

    it("should extract file ID from Google Drive API URL without www", () => {
      const url = "https://googleapis.com/drive/v3/files/1z50hYszT3MhurBB5Y-vfey5frCOgWBTr?alt=media";
      expect(extractGoogleDriveFileId(url)).toBe("1z50hYszT3MhurBB5Y-vfey5frCOgWBTr");
    });

    it("should return null for invalid URLs", () => {
      expect(extractGoogleDriveFileId("https://example.com/file/123")).toBe(null);
      expect(extractGoogleDriveFileId("https://youtube.com/watch?v=123")).toBe(null);
    });

    it("should return null for empty or invalid input", () => {
      expect(extractGoogleDriveFileId("")).toBe(null);
      expect(extractGoogleDriveFileId(null as any)).toBe(null);
      expect(extractGoogleDriveFileId(undefined as any)).toBe(null);
      expect(extractGoogleDriveFileId(123 as any)).toBe(null);
    });
  });
});

describe("Giphy URL Functions", () => {
  describe("isGiphyLink", () => {
    it("should identify Giphy media page URLs", () => {
      const giphyMediaUrl = "https://giphy.com/gifs/bio-attachment-link-C1UbsNbI8hyXmvDFo0";
      expect(isGiphyLink(giphyMediaUrl)).toBe(true);
    });

    it("should identify Giphy gif sharable page URLs", () => {
      const giphyGifUrl =
        "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExa3RrNnE3Mzk5MmpzemI2Y2lvaWdsamdneXVyYWRlYjBlY3U4eXplMCZlcD12MV9naWZzX3NlYXJjaCZjdD1n/WzWiUYLQMMikw/giphy.gif";
      expect(isGiphyLink(giphyGifUrl)).toBe(true);
    });

    it("should identify Giphy hosted binary file URLs", () => {
      const giphySimpleUrl = "https://i.giphy.com/J6SPGKJRZgHLkw9XAt.webp";
      expect(isGiphyLink(giphySimpleUrl)).toBe(true);
    });

    it("should return false for non-Giphy URLs", () => {
      const nonGiphyUrl = "https://example.com/image.gif";
      expect(isGiphyLink(nonGiphyUrl)).toBe(false);
    });

    it("should return false for empty or null URLs", () => {
      expect(isGiphyLink("")).toBe(false);
      expect(isGiphyLink(null as any)).toBe(false);
    });
  });

  describe("alterGiphyLink", () => {
    it("should convert Giphy media page URL to direct GIF URL", () => {
      const giphyMediaUrl = "https://giphy.com/gifs/bio-attachment-link-C1UbsNbI8hyXmvDFo0";
      const expected = "https://i.giphy.com/C1UbsNbI8hyXmvDFo0.gif";
      expect(alterGiphyLink(giphyMediaUrl)).toBe(expected);
    });

    it("should convert Giphy gif sharable page URLs to hosted binary file GIF URL", () => {
      const giphyGifUrl =
        "https://media1.giphy.com/media/v1.Y2lkPTc5MGI3NjExcG9uYWN3dTJ1N2c2Z2tobTNkOGEyMDliNWI0a3VuZGwwNmM5NmljNCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/C1UbsNbI8hyXmvDFo0/giphy.gif";
      const expected = "https://i.giphy.com/C1UbsNbI8hyXmvDFo0.gif";
      expect(alterGiphyLink(giphyGifUrl)).toBe(expected);
    });

    it("should keep Giphy hosted binary file URL as it is", () => {
      // .gif
      const giphySimpleUrlDotGif = "https://i.giphy.com/C1UbsNbI8hyXmvDFo0.gif";
      const expectedDotGif = "https://i.giphy.com/C1UbsNbI8hyXmvDFo0.gif";

      // .webp https://i.giphy.com/lXiRm5H49zYmHr3i0.webp
      const giphySimpleUrlDotWebp = "https://i.giphy.com/lXiRm5H49zYmHr3i0.webp";
      const expectedDotWebp = "https://i.giphy.com/lXiRm5H49zYmHr3i0.gif";

      expect(alterGiphyLink(giphySimpleUrlDotGif)).toBe(expectedDotGif);
      expect(alterGiphyLink(giphySimpleUrlDotWebp)).toBe(expectedDotWebp);
    });

    it("should return null for non-Giphy URLs", () => {
      const nonGiphyUrl = "https://example.com/image.gif";
      expect(alterGiphyLink(nonGiphyUrl)).toBe(null);
    });

    it("should return null for empty or null URLs", () => {
      expect(alterGiphyLink("")).toBe(null);
      expect(alterGiphyLink(null as any)).toBe(null);
    });

    it("should handle URLs with different Giphy ID formats", () => {
      const giphyUrl1 = "https://giphy.com/gifs/category-name-ABC123def";
      const giphyUrl2 = "https://media1.giphy.com/media/XYZ789ghi/giphy.gif";

      expect(alterGiphyLink(giphyUrl1)).toBe("https://i.giphy.com/ABC123def.gif");
      expect(alterGiphyLink(giphyUrl2)).toBe("https://i.giphy.com/XYZ789ghi.gif");
    });
  });
});
