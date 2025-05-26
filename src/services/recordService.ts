// src/services/recordService.ts
/*global NDEFRecord*/ // For the NDEFRecord constructor
import type { Ref } from 'vue';
import type { NDEFRecordInitCustom, ScannedTag } from '../@types/app';

// Assume alert is globally available or handled by a global notification system.
declare function alert(message?: any): void;

export function handleAddRecord(
  recordInit: NDEFRecordInitCustom,
  scannedTag: Ref<ScannedTag>,
  showAddForm: Ref<boolean>
): void {
  console.log("Record init received from form:", recordInit);

  // The NDEFRecord constructor expects NDEFRecordInit, which is similar to NDEFRecordInitCustom
  // but NDEFRecordInitCustom allows for more flexible data types initially from the form.
  // The prepareRecordPayload function in AddRecordForm.vue already does most of the specific
  // data conversion (like smart poster NDEFMessageInit, hex to ArrayBuffer for unknown).
  // Here, we just ensure the payload is what NDEFRecord expects.
  const payload: NDEFRecordInit = {
    recordType: recordInit.recordType,
  };

  if (recordInit.id) payload.id = recordInit.id;
  if (recordInit.mediaType) payload.mediaType = recordInit.mediaType;
  
  // Encoding and lang are generally for 'text' type, or text-based 'mime'/'external'.
  // Smart Poster's text components handle their own lang/encoding.
  if (recordInit.encoding) payload.encoding = recordInit.encoding;
  if (recordInit.lang) payload.lang = recordInit.lang;

  // Data assignment
  if (recordInit.data !== undefined) {
    payload.data = recordInit.data;
  } else if (recordInit.recordType === "empty") {
    // NDEFRecord constructor expects data to be undefined for 'empty'
    payload.data = undefined; 
  }
  // For other types, if recordInit.data is undefined, payload.data will also be undefined,
  // which is acceptable for NDEFRecord constructor (implies empty payload).

  console.log("Payload for NDEFRecord constructor:", payload);

  try {
    const newRecord = new NDEFRecord(payload); // Use the global NDEFRecord

    // Special handling for smart poster: _smartPosterData was a temporary holding field
    // on NDEFRecordInitCustom. The actual NDEFRecord for 'smart-poster' has data=null.
    // The service previously attached this to the created NDEFRecord instance for later use in writeNFC.
    if (newRecord.recordType === "smart-poster" && payload.data) {
      // Attach the original NDEFMessageInit (which was in payload.data) to the instance
      // This is a non-standard property used internally by this app.
      (newRecord as any)._smartPosterData = payload.data;
    }
    
    scannedTag.value.records.push(newRecord);
    console.log("Record added. New records list:", scannedTag.value.records);
  } catch (error) {
    console.error("Error creating NDEFRecord:", error, payload);
    alert(`Error adding record: ${(error as Error).message}`);
  }

  showAddForm.value = false; // Hide form after adding
}

export function handleDeleteRecord(index: number, scannedTag: Ref<ScannedTag>): void {
  if (index >= 0 && index < scannedTag.value.records.length) {
    scannedTag.value.records.splice(index, 1);
    console.log(`Record at index ${index} deleted.`);
  } else {
    console.warn(`Attempted to delete record at invalid index: ${index}`);
  }
}
