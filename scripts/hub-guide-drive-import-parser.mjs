function guideTitle(fileName) {
  return String(fileName || 'Guide')
    .replace(/\.pdf$/i, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim() || 'Guide';
}

export function parseHubGuideDriveFiles(files) {
  return files
    .filter((file) => file?.id && file.mimeType === 'application/pdf')
    .toSorted((left, right) => String(left.name || '').localeCompare(String(right.name || ''), undefined, { sensitivity: 'base' }))
    .map((file, sortOrder) => {
      const fileUrl = file.webViewLink || `https://drive.google.com/file/d/${file.id}/view`;
      return {
        id: `drive-${file.id}`,
        title: guideTitle(file.name),
        description: '',
        fileUrl,
        driveFileId: file.id,
        resourceKey: file.resourceKey || '',
        category: 'Student Handbook & Guides',
        publicDataJson: {
          viewUrl: fileUrl,
          embedUrl: fileUrl,
          downloadUrl: file.webContentLink || `https://drive.google.com/uc?export=download&id=${file.id}`,
          canEmbed: true,
        },
        enabled: true,
        sortOrder,
      };
    });
}

export function summarizeHubGuideDriveImport(files, guides) {
  return {
    scannedFiles: files.length,
    pdfFiles: guides.length,
    skippedNonPdfFiles: files.length - guides.length,
    guideTitles: guides.map((guide) => guide.title),
  };
}
