import TwitterText from "twitter-text";
const {parseTweet} = TwitterText;
import {SocialPlatformTypes} from "./types";

export function callFunctionsSequentially<T>(
  functions: Array<() => Promise<any>>
): Promise<T[] | any[]> {
  return functions.reduce(
    (promiseChain, currentFunction) =>
      promiseChain.then((result) =>
        currentFunction().then(Array.prototype.concat.bind(result))
      ),
    Promise.resolve([])
  );
}
// It will break on error
export function callFunctionsSequentiallyBreak<T>(
  functions: Array<() => Promise<any>>
): Promise<T[] | any> {
  return functions.reduce(
    (promiseChain, currentFunction) =>
      promiseChain.then(
        (result) =>
          currentFunction()
            .then((value) => Array.prototype.concat.call(result, value))
            .catch((error) => Promise.reject(error)) // Reject the promise if an error occurs
      ),
    Promise.resolve([])
  );
}
export async function callNestedFunctionsSequentially<T>(
  functionArrays: Array<Array<() => Promise<T>>>
): Promise<T[][]> {
  const results: T[][] = [];

  for (const functionArray of functionArrays) {
    const innerResults: T[] = [];
    for (const func of functionArray) {
      try {
        const result = await func();
        innerResults.push(result);
      } catch (error) {
        // Reject the promise if an error occurs
        return Promise.reject(error);
      }
    }
    results.push(innerResults);
  }

  return results;
}

export function isObjectEmpty(obj) {
  if (!obj) return true;
  return Object.keys(obj).length === 0;
}

export function addSeconds(numOfSeconds, date = new Date()) {
  date.setSeconds(date.getSeconds() + numOfSeconds);
  return date;
}

export function getSmAccColor(platform) {
  switch (platform) {
    case "facebook":
      return "blue";
    case "instagram":
      return "pink";
    case "linkedin":
      return "default";
    case "twitter":
      return "green";
    case "youtube":
      return "red";
    case "tiktok":
      return "purple";
    case "pinterest":
      return "red";
    default:
      return "default";
  }
}
export const getSocialPlatformImage = (platform: SocialPlatformTypes, imageUrl?: string) => {
  if (imageUrl) return imageUrl;
  switch (platform) {
    case "facebook":
      return "https://res.cloudinary.com/pul/image/upload/v1675157338/icons/facebook.svg";
    case "twitter":
      return "https://res.cloudinary.com/pul/image/upload/v1675157336/icons/twitter.svg";
    case "linkedin":
      return "https://res.cloudinary.com/pul/image/upload/v1675157341/icons/linkedin.svg";
    case "instagram":
      return "https://res.cloudinary.com/pul/image/upload/v1675157339/icons/Instagram.svg";
    case "youtube":
      return "https://res.cloudinary.com/pul/image/upload/v1676906720/icons/youtube.svg";
    case "tiktok":
      return "https://res.cloudinary.com/pul/image/upload/v1689234905/icons/tiktok.svg";
    case "pinterest":
      return "https://res.cloudinary.com/pul/image/upload/v1696496110/icons/pinterest.svg";
    case "threads":
      return "https://res.cloudinary.com/pul/image/upload/v1719118919/icons/threads.svg";
    default:
      return "https://cdn.dribbble.com/users/1787323/screenshots/16418683/media/b698712269a006ae2b97c8cb787a6c14.png?compress=1&resize=1200x900&vertical=top";
  }
};

export function resolvePromisesSequentially(promises) {
  return new Promise((resolve, reject) => {
    try {
      const results = [];
      let index = 0;

      const processPromise = () => {
        if (index >= promises.length) {
          resolve(results);
          return;
        }

        const promise = promises[index];
        promise
          .then((result) => {
            results.push(result);
            index++;
            setTimeout(processPromise, 1000); // Gap of 1 second
          })
          .catch(reject);
      };
      processPromise();
    } catch (error) {
      reject(error);
      console.error("resolvePromisesSequentially", error);
    }
  });
}

export function keepOnlyNumbers(obj) {
  if (!obj || typeof obj !== "object") return null;
  for (const key in obj) {
    if (isNaN(obj[key])) {
      obj[key] = 0;
    } else {
      obj[key] = Number(obj[key]);
    }
  }
  return obj;
}
export function incrementObjectValues(sourceObj, destObj) {
  for (const key in sourceObj) {
    if (typeof sourceObj[key] === "number") {
      destObj[key] = (destObj[key] || 0) + sourceObj[key];
    }
  }
  return destObj;
}

export const getDate = (date) => new Date(date).getTime();

export function splitStringCharacters(inputString, maxTweetLength = 280): string[] {
  const words = inputString.split(" ");
  const tweets = [];
  let currentTweet = "";
  for (const word of words) {
    const newTweet = currentTweet + " " + word;
    if (parseTweet(newTweet).weightedLength > maxTweetLength) {
      tweets.push(currentTweet.trim());
      currentTweet = word;
    } else {
      currentTweet = newTweet.trim();
    }
  }
  tweets.push(currentTweet);
  return tweets;
}

export function matchNotionEmbed(htmlString) {
  const iframeRegex = /<iframe\s+src=['"](https?:\/\/[^'"]+)['"][^>]*><\/iframe>/i;
  const match = htmlString.match(iframeRegex);
  return match;
}
export function extractNotionEmbedUrl(htmlString) {
  const match = matchNotionEmbed(htmlString);

  if (match && match[1]) {
    return match[1];
  }

  return null;
}

export function extractNumbersAndLetters(input) {
  let parsedInput;

  try {
    parsedInput = JSON.parse(input);
  } catch (error) {
    parsedInput = input;
  }

  const inputStr = Array.isArray(parsedInput)
    ? parsedInput.flat().join("")
    : parsedInput.toString();

  const matches = inputStr.match(/[a-zA-Z0-9]+/g);

  return matches || [];
}
export function areArraysEqual(arr1, arr2) {
  // Check if both arrays have the same length
  if (arr1.length !== arr2.length) {
    return false;
  }

  // Convert arrays to sets and compare them
  const set1 = new Set(arr1);
  const set2 = new Set(arr2);

  // Check if the sets have the same size (i.e., the same values)
  return set1.size === set2.size;
}

export function isAnyValueInArray(arrayToCheck, targetArray) {
  // Check if any value of arrayToCheck is present in targetArray
  return arrayToCheck?.some((value) => targetArray?.includes(value));
}

export async function retryOnCondition<Res>(
  promiseFunction,
  errorDestructor,
  errMessage,
  maxRetries = 3
): Promise<Res> {
  let retries = 0;
  const _Error = new Error(errMessage);
  _Error.name = "ServerError";
  _Error["isServerError"] = true;
  // eslint-disable-next-line no-async-promise-executor
  return new Promise(async (res, rej) => {
    while (retries < maxRetries) {
      try {
        const result = await promiseFunction();
        return res(result); // Return the result if the promise resolves successfully
      } catch (error) {
        const retryError = errorDestructor(error);
        if (retryError && retries < maxRetries - 1) {
          // If errorDestructor returns true, retry the promise

          retries++;
          console.log(`Retrying... (Retry ${retries} of ${maxRetries})`);
          await new Promise((resolve) => setTimeout(resolve, 3000));
        } else {
          // If errorDestructor returns false, rethrow the error
          return rej(retryError ? _Error : error);
        }
      }
    }
    console.log(`Max retry attempted reached`);
    rej(_Error);
  });
}

// A function which takes a promise function and ignores any error occured in the promise and return a resolved response with error:true
export function ignorePromiseFuncError<T>(
  promiseFn
): Promise<{error: boolean; message: string} | T> {
  return new Promise((resolve) => {
    promiseFn()
      .then((response) => resolve(response))
      .catch((e) => resolve({error: true, message: e?.message}));
  });
}
export function ignorePromiseError<T>(
  promise: Promise<T>
): Promise<{error: boolean; message: string} | T> {
  return new Promise((resolve) => {
    promise
      .then((response) => resolve(response))
      .catch((e) => resolve({error: true, message: e?.message}));
  });
}

export function safeStringify(obj, maxLength = 50) {
  const seen = new WeakSet();
  return JSON.stringify(
    obj,
    (key, value) => {
      if (typeof value === "object" && value !== null) {
        if (seen.has(value)) {
          return "[Circular]";
        }
        seen.add(value);
      }
      if (Buffer.isBuffer(value)) {
        return `[Buffer: ${value.length} bytes]`;
      }
      if (ArrayBuffer.isView(value) || value instanceof ArrayBuffer) {
        return "[ArrayBuffer]";
      }
      if (typeof value === "string" && value.length > maxLength) {
        return value.slice(0, maxLength) + "...";
      }
      return value;
    },
    2
  );
}
export function mapFulfilled<T>(results: PromiseSettledResult<T>[]) {
  return results
    .filter((result) => result.status == "fulfilled")
    .map((result) => result.value);
}
