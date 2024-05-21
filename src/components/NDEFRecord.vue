<script setup lang="ts">
/*global NDEFRecord*/
/*global NDEFRecordInit*/

import { ref } from "vue";
import { PencilAltIcon } from "@heroicons/vue/solid";

defineProps<{
  record: NDEFRecord;
}>();

const editMode = ref(false);

function decodeRecord(record: NDEFRecord) {
  const decoder = new TextDecoder(record.encoding ?? "utf-8");
  return decoder.decode(record.data?.buffer);
}
</script>

<template>
  <div
    class="text-black dark:text-white flex flex-col p-2 border border-gray-200 dark:border-gray-700"
  >
    <div
      class="flex space-x-4 mb-2 text-sm flex-row flex-shrink-0 flex-basis-0"
    >
      <div class="grow">
        <p>Id:</p>
        <p>{{ record.id ?? "N/A" }}</p>
      </div>
      <div class="grow">
        <p>Type:</p>
        <p>{{ record.recordType }}</p>
      </div>
      <div class="grow">
        <p>Mime:</p>
        <p>{{ record.mediaType ?? "N/A" }}</p>
      </div>
      <div class="grow">
        <p>Encoding:</p>
        <p>{{ record.encoding ?? "N/A" }}</p>
      </div>
      <div class="grow">
        <p>Language:</p>
        <p>{{ record.lang ?? "N/A" }}</p>
      </div>
      <div class="grow text-right">
        <PencilAltIcon
          class="w-6 h-6 inline-block"
          @click="editMode = !editMode"
        />
      </div>
    </div>
    <div class="flex space-x-4">
      <div>{{ decodeRecord(record) }}</div>
    </div>
    {{ editMode ? "EDIT!" : "" }}
  </div>
</template>

<style></style>
