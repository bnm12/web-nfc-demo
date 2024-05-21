<script setup lang="ts">
/*global NDEFReader*/
/*global NDEFRecord*/
/*global NDEFRecordInit*/

import NDEFRecordVue from "./components/NDEFRecord.vue";
import SpinnerIcon from "./assets/SpinnerIcon.vue";
import PauseIcon from "./assets/PauseIcon.vue";

import { ref } from "vue";

const scannedTag = ref({ uuid: "", records: [] as NDEFRecord[] });
const status = ref({ writing: false, reading: false });

async function readNFC() {
  const ndef = new NDEFReader();
  await ndef.scan();
  ndef.onreading = (event) => {
    if (status.value.writing) return;
    console.log(event);
    scannedTag.value.uuid = event.serialNumber;
    scannedTag.value.records = [];
    scannedTag.value.records.push(...event.message.records);
  };
  status.value.reading = true;
}

async function writeNFC(records: NDEFRecord[]) {
  if (!records.length) return;
  const ndef = new NDEFReader();
  const recs = records.map((rec) => {
    const obj = {} as NDEFRecordInit;
    obj.recordType = rec.recordType;
    if (rec.mediaType) obj.mediaType = rec.mediaType;
    if (rec.id) obj.id = rec.id;
    if (rec.encoding) obj.encoding = rec.encoding;
    if (rec.lang) obj.lang = rec.lang;
    if (rec.data)
      obj.data = rec.recordType === "mime" ? rec.data : decodeRecord(rec);

    return obj;
  });
  console.log(recs);
  status.value.writing = true;
  try {
    await ndef.write({
      records: recs,
    });
  } catch (err) {
    console.log(err, arguments);
    alert(err);
  }
  status.value.writing = false;
}

function decodeRecord(record: NDEFRecord) {
  const decoder = new TextDecoder(record.encoding ?? "utf-8");
  return decoder.decode(record.data?.buffer);
}
</script>

<template>
  <div class="flex flex-col p-2">
    <div class="flex flex-row space-x-2 mb-2">
      <button
        @click="readNFC"
        class="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 grow flex items-center"
      >
        <div class="w-4 h-4"></div>
        <div class="grow text-center">Scan</div>
        <div class="w-4 h-4">
          <SpinnerIcon
            v-if="status.reading && !status.writing"
            class="text-gray-200 animate-spin dark:text-gray-700 fill-white"
          />
          <PauseIcon
            v-if="status.reading && status.writing"
            class="text-gray-200 dark:text-gray-700 fill-gray-700"
          />
        </div>
      </button>
      <button
        @click="writeNFC(scannedTag.records)"
        :disabled="!scannedTag.records.length"
        class="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 disabled:bg-gray-500 disabled:opacity-50 grow flex items-center"
      >
        <div class="w-4 h-4"></div>
        <div class="grow text-center">Write</div>
        <div class="w-4 h-4">
          <SpinnerIcon
            v-if="status.writing"
            class="text-gray-200 animate-spin dark:text-gray-700 fill-white"
          />
        </div>
      </button>
    </div>
    <h3
      v-if="scannedTag.uuid"
      class="text-black dark:text-white text-lg mb-2 text-center"
    >
      UID: {{ scannedTag.uuid.toUpperCase() }}
    </h3>
    <NDEFRecordVue
      v-for="(record, index) in scannedTag.records"
      :key="index"
      :record="record"
      class="mb-1"
    />
  </div>
</template>

<style></style>
