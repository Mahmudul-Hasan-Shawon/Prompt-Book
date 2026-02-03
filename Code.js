// Updated Code.gs with multiple endpoint support
function doGet(e) {
  // Check if it's a JSON request
  if (e && e.parameter && e.parameter.action === 'getData') {
    return getDataJSON();
  }

  // Otherwise serve the HTML app
  return serveHTML();
}

function doPost(e) {
  try {
    // Parse the parameters
    const params = e.parameter;
    let data;

    if (e.postData && e.postData.contents) {
      // Parse from POST body
      data = JSON.parse(e.postData.contents);
    } else {
      // Parse from URL parameters
      data = JSON.parse(params.data || '{}');
    }

    const action = params.action;

    switch (action) {
      case 'save':
        const saveResult = saveComponent(data);
        return ContentService
          .createTextOutput(JSON.stringify(saveResult))
          .setMimeType(ContentService.MimeType.JSON);

      case 'delete':
        const deleteResult = deleteComponent(data.id);
        return ContentService
          .createTextOutput(JSON.stringify(deleteResult))
          .setMimeType(ContentService.MimeType.JSON);

      default:
        return ContentService
          .createTextOutput(JSON.stringify({ error: 'Invalid action' }))
          .setMimeType(ContentService.MimeType.JSON);
    }
  } catch (error) {
    console.error('Error in doPost:', error);
    return ContentService
      .createTextOutput(JSON.stringify({
        success: false,
        error: error.message
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function getDataJSON() {
  try {
    const data = getSheetData();
    return ContentService
      .createTextOutput(JSON.stringify(data))
      .setMimeType(ContentService.MimeType.JSON)
      .setHeader('Access-Control-Allow-Origin', '*');
  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({
        error: error.message
      }))
      .setMimeType(ContentService.MimeType.JSON)
      .setHeader('Access-Control-Allow-Origin', '*');
  }
}

function serveHTML() {
  var html = HtmlService.createTemplateFromFile("index");
  var evaluated = html.evaluate();
  evaluated.addMetaTag("viewport", "width=device-width, initial-scale=1");
  return evaluated
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .setFaviconUrl("https://cdn-icons-png.flaticon.com/512/12133/12133548.png")
    .setTitle("Glassmorphism UI Manager");
}
// Keep all your existing functions...


function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function getSheetData() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const promptSheet = ss.getSheetByName("Prompt");
    const settingsSheet = ss.getSheetByName("Settings");

    if (!promptSheet) {
      throw new Error("Prompt sheet not found");
    }

    // Get all data from Prompt sheet
    const promptData = getSheetDataAsObjects(promptSheet);

    // Process components
    const components = promptData.map(function (row, index) {
      return {
        id: index + 1,
        prompt: row.Prompt || '',
        imageUrl: row['Image Link'] || '',
        category: row.Category || '',
        tag: row.Tag || '',
        tagColor: row['Tag Color'] || getDefaultTagColor(row.Category, row.Tag),
        keywords: (row.Keywords || '').split(',').map(k => k.trim()).filter(k => k)
      };
    });

    // Get all categories from Settings sheet
    let allCategories = [];
    if (settingsSheet) {
      const settingsData = getSheetDataAsObjects(settingsSheet);
      allCategories = settingsData.map(function (row) {
        return {
          category: row.Category || '',
          tag: row.Tag || '',
          color: row['Tag Color'] || getDefaultTagColor(row.Category, row.Tag)
        };
      });
    }

    // Get unique categories for dropdown
    const uniqueCategories = [...new Set(allCategories.map(item => item.category).filter(Boolean))];

    return {
      components: components,
      categories: uniqueCategories,
      categoryData: allCategories,
      lastUpdated: new Date().toISOString()
    };

  } catch (error) {
    console.error('Error in getSheetData:', error);
    throw new Error('Failed to load data: ' + error.message);
  }
}

function getComponentById(id) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const promptSheet = ss.getSheetByName("Prompt");

    if (!promptSheet) {
      throw new Error("Prompt sheet not found");
    }

    const data = promptSheet.getDataRange().getValues();
    if (data.length < 2) return null;

    const headers = data[0];
    // Convert ID to row index (ID starts from 1, data rows start from 2)
    const rowIndex = parseInt(id);

    if (rowIndex >= 1 && rowIndex <= data.length - 1) {
      const row = data[rowIndex];
      const obj = {};
      headers.forEach(function (header, index) {
        obj[header] = row[index] || '';
      });

      return {
        id: rowIndex,
        prompt: obj.Prompt || '',
        imageUrl: obj['Image Link'] || '',
        category: obj.Category || '',
        tag: obj.Tag || '',
        tagColor: obj['Tag Color'] || getDefaultTagColor(obj.Category, obj.Tag),
        keywords: (obj.Keywords || '').split(',').map(k => k.trim()).filter(k => k)
      };
    }

    return null;

  } catch (error) {
    console.error('Error in getComponentById:', error);
    throw new Error('Failed to get component: ' + error.message);
  }
}

function getSheetDataAsObjects(sheet) {
  const data = sheet.getDataRange().getValues();
  if (data.length === 0) return [];

  const headers = data[0];
  const rows = data.slice(1);

  return rows.map(function (row) {
    const obj = {};
    headers.forEach(function (header, index) {
      obj[header] = row[index] || '';
    });
    return obj;
  });
}

function getTagsByCategory(category) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const settingsSheet = ss.getSheetByName("Settings");

    if (!settingsSheet) {
      return [];
    }

    const data = getSheetDataAsObjects(settingsSheet);
    const tags = data
      .filter(function (item) {
        return item.Category === category;
      })
      .map(function (item) {
        return {
          tag: item.Tag || '',
          color: item['Tag Color'] || getDefaultTagColor(category, item.Tag)
        };
      });

    return tags;

  } catch (error) {
    console.error('Error in getTagsByCategory:', error);
    return [];
  }
}

function saveComponent(componentData) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("Prompt");

    if (!sheet) {
      throw new Error("Prompt sheet not found");
    }

    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

    // Prepare row data
    const rowData = headers.map(function (header) {
      switch (header) {
        case 'Prompt': return componentData.prompt || '';
        case 'Image Link': return componentData.imageUrl || '';
        case 'Category': return componentData.category || '';
        case 'Tag': return componentData.tag || '';
        case 'Tag Color': return componentData.tagColor || getDefaultTagColor(componentData.category, componentData.tag);
        case 'Keywords': return Array.isArray(componentData.keywords) ? componentData.keywords.join(', ') : componentData.keywords || '';
        default: return '';
      }
    });

    if (componentData.id && componentData.id !== '' && componentData.id !== 'new') {
      // Update existing row
      const rowIndex = parseInt(componentData.id) + 1;
      if (rowIndex <= sheet.getLastRow()) {
        sheet.getRange(rowIndex, 1, 1, headers.length).setValues([rowData]);
        return {
          success: true,
          id: componentData.id,
          message: 'Component updated successfully'
        };
      }
    }

    // Add new row
    sheet.appendRow(rowData);
    const newRowIndex = sheet.getLastRow() - 1; // -1 because header is row 1

    return {
      success: true,
      id: newRowIndex,
      message: 'Component added successfully'
    };

  } catch (error) {
    console.error('Error in saveComponent:', error);
    throw new Error('Failed to save: ' + error.message);
  }
}

function deleteComponent(componentId) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("Prompt");

    if (!sheet) {
      throw new Error("Prompt sheet not found");
    }

    const rowToDelete = parseInt(componentId) + 1;

    if (rowToDelete > 1 && rowToDelete <= sheet.getLastRow()) {
      sheet.deleteRow(rowToDelete);
      return {
        success: true,
        message: 'Component deleted successfully'
      };
    }

    return {
      success: false,
      message: 'Component not found'
    };

  } catch (error) {
    console.error('Error in deleteComponent:', error);
    throw new Error('Failed to delete: ' + error.message);
  }
}

function getDefaultTagColor(category, tag) {
  // Default color scheme based on your data
  const colorMap = {
    'UI Design': 'bg-purple-50 text-purple-600 border-purple-100',
    'Dashboard': 'bg-purple-100 text-purple-700 border-purple-200',
    'Mobile UI': 'bg-violet-50 text-violet-600 border-violet-100',
    'Web Design': 'bg-violet-100 text-violet-700 border-violet-200',
    'UI Components': 'bg-fuchsia-50 text-fuchsia-600 border-fuchsia-100',
    'Web UI': 'bg-fuchsia-100 text-fuchsia-700 border-fuchsia-200',
    'App UI': 'bg-indigo-50 text-indigo-600 border-indigo-100'
  };

  return colorMap[category] || 'bg-gray-100 text-gray-700 border-gray-200';
}