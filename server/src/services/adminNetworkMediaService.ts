export {};

const {
  insertNetworkMedia,
  selectNetworkMediaList,
  selectNetworkMediaFile,
  insertNetworkNotation,
  selectNetworkNotations,
  insertNetworkNote,
  selectNetworkNotes,
  softDeleteNetworkNote,
  updateNetworkNoteContent,
  insertNoteMedia,
  selectNoteMediaById,
  selectNoteMediaList,
  deleteNoteMedia,
} = require('../repositories/adminNetworkMediaRepository');

module.exports = {
  uploadNetworkMedia: insertNetworkMedia,
  getNetworkMediaList: selectNetworkMediaList,
  getNetworkMediaFile: selectNetworkMediaFile,
  addNetworkNotation: insertNetworkNotation,
  getNetworkNotations: selectNetworkNotations,
  addNetworkNoteWithFunction: insertNetworkNote,
  getNetworkNotes: selectNetworkNotes,
  deleteNetworkNote: softDeleteNetworkNote,
  updateNetworkNote: updateNetworkNoteContent,
  addNoteMedia: insertNoteMedia,
  getNoteMediaById: selectNoteMediaById,
  getNoteMediaList: selectNoteMediaList,
  deleteNoteMedia,
};
