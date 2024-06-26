// Type definitions for Web NFC
// Project: https://github.com/w3c/web-nfc
// Definitions by: Takefumi Yoshii <https://github.com/takefumi-yoshii>
// TypeScript Version: 3.9

// This type definitions referenced to WebIDL.
// https://w3c.github.io/web-nfc/#actual-idl-index

interface Window {
  NDEFMessage: NDEFMessage;
}
declare class NDEFMessage {
  constructor(messageInit: NDEFMessageInit);
  records: ReadonlyArray<NDEFRecord>;
}
declare interface NDEFMessageInit {
  records: NDEFRecordInit[];
}

declare type NDEFRecordDataSource = string | BufferSource | NDEFMessageInit;

interface Window {
  NDEFRecord: NDEFRecord;
}
declare type NDEFRecordTypeExternal = `${string}.${string}:${string}`;

declare function isNDEFRecordTypeExternal(
  type: NDEFRecordType | NDEFRecordTypeExternal | string
): type is NDEFRecordTypeExternal {
  if (!type) return false;
  const regex = /^\w+?\.\w+:\w+$/;
  return regex.test(type);
};

declare enum NDEFRecordType {
  AbsoluteUrl = "absolute-url", // An absolute URL to the data.
  Empty = "empty", // An empty NDEFRecord.
  Mime = "mime", // A valid MIME type.
  SmartPoster = "smart-poster", // A smart poster as defined by the NDEF-SMARTPOSTER specification.
  Text = "text", // Text as defined by the NDEF-TEXT specification.
  Unknown = "unknown", // The record type is not known.
  Url = "url", // A URL as defined by the NDEF-URI specification.
}

declare type MIMETypeString = `${string}/${string}`;

declare class NDEFRecord {
  constructor(recordInit: NDEFRecordInit);
  readonly recordType: NDEFRecordType | NDEFRecordTypeExternal;
  readonly mediaType?: MIMETypeString;
  readonly id?: string;
  readonly data?: DataView;
  readonly encoding?: string;
  readonly lang?: string;
  toRecords?: () => NDEFRecord[];
}
declare interface NDEFRecordInit {
  recordType: string;
  mediaType?: string;
  id?: string;
  encoding?: string;
  lang?: string;
  data?: NDEFRecordDataSource;
}

declare type NDEFMessageSource = string | BufferSource | NDEFMessageInit;

interface Window {
  NDEFReader: NDEFReader;
}
declare class NDEFReader extends EventTarget {
  constructor();
  onreading: (this: this, event: NDEFReadingEvent) => any;
  onreadingerror: (this: this, error: Event) => any;
  scan: (options?: NDEFScanOptions) => Promise<void>;
  write: (
    message: NDEFMessageSource,
    options?: NDEFWriteOptions
  ) => Promise<void>;
  makeReadOnly: (options?: NDEFMakeReadOnlyOptions) => Promise<void>;
}

interface Window {
  NDEFReadingEvent: NDEFReadingEvent;
}
declare class NDEFReadingEvent extends Event {
  constructor(type: string, readingEventInitDict: NDEFReadingEventInit);
  serialNumber: string;
  message: NDEFMessage;
}
interface NDEFReadingEventInit extends EventInit {
  serialNumber?: string;
  message: NDEFMessageInit;
}

interface NDEFWriteOptions {
  overwrite?: boolean;
  signal?: AbortSignal;
}
interface NDEFMakeReadOnlyOptions {
  signal?: AbortSignal;
}
interface NDEFScanOptions {
  signal: AbortSignal;
}
