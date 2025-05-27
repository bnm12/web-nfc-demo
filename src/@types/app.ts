// src/@types/app.ts

// Replicates NDEFRecordInit from WebNFC spec but allows for custom data types
// from forms before they are processed into standard NDEFRecord data.
export interface NDEFRecordInitCustom {
  recordType: string; // Can be standard or external like "example.com:mytype"
  mediaType?: string;
  id?: string;
  encoding?: string;
  lang?: string;
  data?: string | ArrayBuffer | NDEFMessageInit; // Data from form, NDEFMessageInit for smart poster
}

export interface NFCStatus {
  writing: boolean;
  reading: boolean;
}

export interface ScannedTag {
  uuid: string;
  records: NDEFRecord[]; // Using the global NDEFRecord type
}

// NDEFMessageInit is part of the WebNFC API (global)
// interface NDEFMessageInit {
//   records: NDEFRecordInit[];
// }
// NDEFRecord is also a global type provided by the WebNFC API.
// /*global NDEFRecord, NDEFMessageInit*/
// These comments are usually placed in files that use them if not covered by tsconfig "types".
// For this file, which *defines* interfaces that *use* them, it's more about ensuring
// the consumer files understand where these globals come from.
// The actual /*global*/ declarations will be in the .vue or .ts files that directly use NDEFReader etc.
