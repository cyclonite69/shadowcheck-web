const adminNetworkMediaService = require('../../../server/src/services/adminNetworkMediaService');
const adminNetworkMediaRepository = require('../../../server/src/repositories/adminNetworkMediaRepository');

jest.mock('../../../server/src/repositories/adminNetworkMediaRepository');

describe('adminNetworkMediaService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('uploadNetworkMedia calls repository', async () => {
    adminNetworkMediaRepository.insertNetworkMedia.mockResolvedValue({ id: 1 });
    const result = await adminNetworkMediaService.uploadNetworkMedia({ file: 'data' });
    expect(adminNetworkMediaRepository.insertNetworkMedia).toHaveBeenCalledWith({ file: 'data' });
    expect(result).toEqual({ id: 1 });
  });

  test('getNetworkMediaList calls repository', async () => {
    adminNetworkMediaRepository.selectNetworkMediaList.mockResolvedValue([]);
    const result = await adminNetworkMediaService.getNetworkMediaList(1);
    expect(adminNetworkMediaRepository.selectNetworkMediaList).toHaveBeenCalledWith(1);
    expect(result).toEqual([]);
  });

  test('getNetworkMediaFile calls repository', async () => {
    adminNetworkMediaRepository.selectNetworkMediaFile.mockResolvedValue('file_data');
    const result = await adminNetworkMediaService.getNetworkMediaFile(1);
    expect(adminNetworkMediaRepository.selectNetworkMediaFile).toHaveBeenCalledWith(1);
    expect(result).toEqual('file_data');
  });

  test('getUnmatchedMediaPoints delegates without changing repository rows', async () => {
    const rows = [{ id: '42', bssid: 'VISINT_UNMATCHED' }];
    adminNetworkMediaRepository.selectUnmatchedMediaPoints.mockResolvedValue(rows);

    const result = await adminNetworkMediaService.getUnmatchedMediaPoints();

    expect(adminNetworkMediaRepository.selectUnmatchedMediaPoints).toHaveBeenCalledWith();
    expect(result).toBe(rows);
  });

  test('getMatchedMediaPoints delegates without changing repository rows', async () => {
    const rows = [{ component_id: 'AA:BB:CC:DD:EE:FF', media_count: 2 }];
    adminNetworkMediaRepository.selectMatchedMediaPoints.mockResolvedValue(rows);

    const result = await adminNetworkMediaService.getMatchedMediaPoints();

    expect(adminNetworkMediaRepository.selectMatchedMediaPoints).toHaveBeenCalledWith();
    expect(result).toBe(rows);
  });

  test('addNetworkNotation calls repository', async () => {
    adminNetworkMediaRepository.insertNetworkNotation.mockResolvedValue(true);
    const result = await adminNetworkMediaService.addNetworkNotation(1, 'note');
    expect(adminNetworkMediaRepository.insertNetworkNotation).toHaveBeenCalledWith(1, 'note');
    expect(result).toBe(true);
  });

  test('getNetworkNotations calls repository', async () => {
    adminNetworkMediaRepository.selectNetworkNotations.mockResolvedValue([]);
    const result = await adminNetworkMediaService.getNetworkNotations(1);
    expect(adminNetworkMediaRepository.selectNetworkNotations).toHaveBeenCalledWith(1);
    expect(result).toEqual([]);
  });

  test('addNetworkNoteWithFunction calls repository', async () => {
    adminNetworkMediaRepository.insertNetworkNote.mockResolvedValue(true);
    const result = await adminNetworkMediaService.addNetworkNoteWithFunction(1, 'note');
    expect(adminNetworkMediaRepository.insertNetworkNote).toHaveBeenCalledWith(1, 'note');
    expect(result).toBe(true);
  });

  test('getNetworkNotes calls repository', async () => {
    adminNetworkMediaRepository.selectNetworkNotes.mockResolvedValue([]);
    const result = await adminNetworkMediaService.getNetworkNotes(1);
    expect(adminNetworkMediaRepository.selectNetworkNotes).toHaveBeenCalledWith(1);
    expect(result).toEqual([]);
  });

  test('deleteNetworkNote calls repository', async () => {
    adminNetworkMediaRepository.deleteNetworkNote.mockResolvedValue(true);
    const result = await adminNetworkMediaService.deleteNetworkNote(1);
    expect(adminNetworkMediaRepository.deleteNetworkNote).toHaveBeenCalledWith(1);
    expect(result).toBe(true);
  });

  test('updateNetworkNote calls repository', async () => {
    adminNetworkMediaRepository.updateNetworkNoteContent.mockResolvedValue(true);
    const result = await adminNetworkMediaService.updateNetworkNote(1, 'new');
    expect(adminNetworkMediaRepository.updateNetworkNoteContent).toHaveBeenCalledWith(1, 'new');
    expect(result).toBe(true);
  });

  test('getNetworkNoteById calls repository', async () => {
    adminNetworkMediaRepository.selectNetworkNoteById.mockResolvedValue({ id: 1 });
    const result = await adminNetworkMediaService.getNetworkNoteById(1);
    expect(adminNetworkMediaRepository.selectNetworkNoteById).toHaveBeenCalledWith(1);
    expect(result).toEqual({ id: 1 });
  });

  test('addNoteMedia calls repository', async () => {
    adminNetworkMediaRepository.insertNoteMedia.mockResolvedValue(true);
    const result = await adminNetworkMediaService.addNoteMedia(1, 'media');
    expect(adminNetworkMediaRepository.insertNoteMedia).toHaveBeenCalledWith(1, 'media');
    expect(result).toBe(true);
  });

  test('getNoteMediaById calls repository', async () => {
    adminNetworkMediaRepository.selectNoteMediaById.mockResolvedValue({ id: 1 });
    const result = await adminNetworkMediaService.getNoteMediaById(1);
    expect(adminNetworkMediaRepository.selectNoteMediaById).toHaveBeenCalledWith(1);
    expect(result).toEqual({ id: 1 });
  });

  test('getNoteMediaList calls repository', async () => {
    adminNetworkMediaRepository.selectNoteMediaList.mockResolvedValue([]);
    const result = await adminNetworkMediaService.getNoteMediaList(1);
    expect(adminNetworkMediaRepository.selectNoteMediaList).toHaveBeenCalledWith(1);
    expect(result).toEqual([]);
  });

  test('deleteNoteMedia calls repository', async () => {
    adminNetworkMediaRepository.deleteNoteMedia.mockResolvedValue(true);
    const result = await adminNetworkMediaService.deleteNoteMedia(1);
    expect(adminNetworkMediaRepository.deleteNoteMedia).toHaveBeenCalledWith(1);
    expect(result).toBe(true);
  });
});
