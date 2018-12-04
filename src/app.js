function exec() {
    var conf = getConf();
    var cw = new Chatwork(conf);
    try {
        cw.remind()
    } catch (e) {
        cw.noticeToAdmin(e);
    }
}

function getConf() {
    var sheet = SpreadsheetApp.getActive().getSheetByName('conf');
    var lastRow = sheet.getLastRow();
    var conf = {};
    for (var i = 1; i <= lastRow; i++) {
        var rowData = getRowValues(sheet, i);

        var key = rowData[0];
        // configマッピング
        switch (key) {
            case 'botid':
                conf[key] = rowData[1]
                break;
            case 'token':
                conf[key] = rowData[1]
                break;
            case 'admin_room':
                conf[key] = rowData[1]
                break;
            case 'group_ids':
                conf[key] = []
                for (var j = 1; j < rowData.length; j++) {
                    conf[key].push(rowData[j])
                }
                break;
            default:
                throw new Error('conf has invalid key.')break;

        }
    }
    return conf
}

function getRowValues(sheet, rowIndex) {
    var lastColumn = sheet.getLastColumn();
    return sheet.getRange(rowIndex, 1, rowIndex, lastColumn).getValues()[0]
}
