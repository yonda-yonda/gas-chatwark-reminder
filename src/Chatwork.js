var URL = 'https://api.chatwork.com/v2/';
var REMAIN_LIMIT = 300;

function Chatwork(conf) {
    this.remain = REMAIN_LIMIT;
    this.token = conf.token;
    this.botid = conf.botid;
    if (conf.hasOwnProperty('admin_room')) {
      this.adminRoom = conf.admin_room;
    } else {
        this.adminRoom = null;
    }
    if (conf.hasOwnProperty('group_ids')) {
        this.groupIds = conf.group_ids;
    } else {
        this.groupIds = this.getGroupIdList();
    }
}

Chatwork.prototype.baseUrl = URL;

Chatwork.prototype.get = function(apiMethod) {
    var url = this.baseUrl + apiMethod;
    var options = {
        'headers': {
            'X-ChatWorkToken': this.token
        }
    };
    var response = UrlFetchApp.fetch(url, options);
    var content = response.getContentText('UTF-8');
    this.updateRateLimit(response)
    return JSON.parse(content);
}

Chatwork.prototype.post = function(apiMethod, query) {
    var url = this.baseUrl + apiMethod;
    var options = {
        'method': 'POST',
        'headers': {
            'X-ChatWorkToken': this.token
        },
        'payload': query
    };
    var response = UrlFetchApp.fetch(url, options);
    var content = response.getContentText('UTF-8');
    return JSON.parse(content);
}

/**
 * noticeToAdmin
 * 管理者に通知
 *
 * @param {string} errorMessage エラーメッセージ
 *
 */
Chatwork.prototype.noticeToAdmin = function(errorMessage) {
    if(this.adminRoom === null) return {};
    var message = '[info]' + errorMessage + '[/info]'
    return this.post("/rooms/" + this.adminRoom + "/messages", {'body': message})
}

/**
 * updateRateLimit
 * API制限回数を更新
 *
 * @param {Object} response レスポンスオブジェクト
 *
 */
Chatwork.prototype.updateRateLimit = function(response) {
    this.remain = parseInt(response.getHeaders()['x-ratelimit-remaining']);

    if (this.remain <= 1) {
        throw new OverApiLimitError()
    }
}


/**
 * getGroupIdList
 * 所属しているチャットルームのIDを取得
 */
Chatwork.prototype.getGroupIdList = function() {
    var rooms = this.get('rooms')
    var groupIds = rooms.filter(function(room) {
        return room['type'] === 'group'
    }).map(function(room) {
        return room['room_id']
    })
    return groupIds; // numberの配列
}


/**
 * getRoomsOpenTasks
 * 指定したチャットルーム内のオープンなタスクを取得
 *
 * @param {number} roomId チャットルームID
 *
 */
Chatwork.prototype.getRoomsOpenTasks = function(roomId) {
    return this.get('rooms/' + roomId + '/tasks?status=open')
}

/**
 * filterTasksExpiredYesterdayBefore
 * 終了時刻が前日以前のタスクの配列を返す
 *
 * @param {Array} tasks タスクの配列
 *
 */
Chatwork.prototype.filterTasksExpiredYesterdayBefore = function(tasks) {
    var now = new Date();
    var todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);

    return tasks.filter(function(task) {
        var date = new Date(task['limit_time'] * 1000);
        return date.getTime() < todayStart.getTime();
    })
}

/**
 * filterTasksExpiredToday
 * 終了時刻が当日のタスクの配列を返す
 *
 * @param {Array} tasks タスクの配列
 *
 */
Chatwork.prototype.filterTasksExpiredToday = function(tasks) {
    var now = new Date();
    var todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    var tomorrowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0);

    return tasks.filter(function(task) {
        var date = new Date(task['limit_time'] * 1000);
        return date.getTime() >= todayStart.getTime() && date.getTime() < tomorrowStart.getTime();
    })
}

/**
 * postRemind
 * 期日が今日までのタスクのリマインドを送信
 *
 * @param {number} roomId チャットルームID
 * @param {Array} tasksExpiredYesterdayBefore 期限が前日以前のタスクの配列
 * @param {Array} tasksExpiredToday 期限が当日のタスクの配列
 *
 */
Chatwork.prototype.postRemind = function(id, tasksExpiredYesterdayBefore, tasksExpiredToday) {
    var message = '';
    var self = this;
    if (expiredTodayTasks.length > 0) {
        message += '今日が期限のタスクがあります。\r\n忘れずに実行してください。！\r\n';
        expiredTodayTasks.forEach(function(task) {
            if (task['account']['account_id'] !== self.botId) {
                message += '[To:' + task['account']['account_id'] + '][info]https://kcw.kddi.ne.jp/#!rid' + id + '-' + task['message_id'] + '[/info]\r\n';
            }
        })
        message += '\r\n';
    }
    if (expiredYesterdayBeforeTasks.length > 0) {
        message += '期限切れのタスクがあります。\r\n';
        expiredYesterdayBeforeTasks.forEach(function(task) {
            if (task['account']['account_id'] !== self.botId) {
                message += '[To:' + task['account']['account_id'] + '][info]https://kcw.kddi.ne.jp/#!rid' + id + '-' + task['message_id'] + '[/info]\r\n';
            }
        })
    }
    this.post('/rooms/' + roomId + '/messages', {'body': message});
}

/**
 * remind
 * リマインド実行
 */
Chatwork.prototype.remind = function() {
    var self = this;
    this.groupIds.forEach(function(groupId) {
        var tasks = self.getRoomsOpenTasks(groupId).filter(function(task) {
            return task['limit_time'] > 0
        });

        var expiredYesterdayBeforeTasks = self.filterTasksExpiredYesterdayBefore(tasks);
        var expiredTodayTasks = self.filterTasksExpiredToday(tasks);

        self.postRemind(groupId, expiredYesterdayBeforeTasks, expiredTodayTasks);
    })
}

/**
 * OverApiLimitError
 * カスタムエラー
 *
 * @param {string} message エラーメッセージ
 *
 */
OverApiLimitError = function(message) {
    this.message = typeof(message) === 'undefined'
        ? 'Over API Limit.'
        : message;
}
OverApiLimitError.prototype = new Error;
OverApiLimitError.prototype.constractor = OverApiLimitError;
