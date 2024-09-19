import { BaseParser } from "./BaseParser";
import { CNNParser } from "./CNNParser";
import { FoxParser } from "./FoxParser";
import { SmartParser } from "./SmartParser";
import { getHostname } from "./helpers";

type ParserMapType = Record<string, typeof BaseParser>;

// Mapping of hostname to parser
const parsers: ParserMapType = {
  "www.foxnews.com": FoxParser,
  "www.cnn.com": CNNParser,
  // 'siteB.com': parseSiteB
};

/**
 * Get the parser object for the given URL
 * @param url
 * @param html
 * @returns An instantiated parser object for the given URL
 */
export const getParser = (url: string, html: string): BaseParser => {
  // const hostname = getHostname(url);
  // const ParserClass = parsers[hostname] || SmartParser;
  const ParserClass = SmartParser;
  return new ParserClass(url, html);
};
