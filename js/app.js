// 简单的 PubSub
var pubsub = {
    _events: {},
    pub: function (event, data) {
        if (!this._events[event]) return;
        for (var i = 0; i < this._events[event].length; i++)
            this._events[event][i](data);
    },
    sub: function (event, callback) {
        if (!this._events[event]) this._events[event] = [];
        this._events[event].push(callback);
    }
}

// 表盘组件基类
var Dial = {
    getDefaultProps: function () {
        return {
            height: 400,
            width: 400,
            radius: 180,
            dot: { x: 400 / 2, y: 400 / 2, radius: 12 }
        };
    },
    getContext: function () {
        // isMounted()
        return this.refs.canvas.getDOMNode().getContext('2d');
    },

    /**
     * 绘制外部轮廓
     */
    drawOutline: function () {
        // 获取 canvas 对象
        var ctx = this.getContext();

        // 画大圆 
        ctx.beginPath();
        ctx.lineWidth = 4;
        ctx.strokeStyle = '#FFFFFF';
        ctx.arc(this.props.dot.x, this.props.dot.y, this.props.radius, 0, 2 * Math.PI, true);
        ctx.stroke();
        ctx.closePath();

        // 画圆心
        ctx.beginPath();
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#FFFFFF';
        ctx.arc(this.props.dot.x, this.props.dot.y, this.props.dot.radius, 0, 2 * Math.PI, true);
        ctx.stroke();
        ctx.closePath();
    },
    componentDidMount: function () {
        this.drawOutline();
        this.drawScale();
    },
    render: function () {
        return (
            React.createElement("canvas", { ref: "canvas", height: this.props.height, width: this.props.width })
        );
    },
};

// 指针组件基类
var Pointer = {
    frames: [],
    getDefaultProps: function () {
        return {
            angle: 30,
            height: 400,
            width: 400,
            dot: { x: 400 / 2, y: 400 / 2, radius: 12 }
        };
    },
    getContext: function () {
        // isMounted()
        return this.refs.canvas.getDOMNode().getContext('2d');
    },
    prepareAnimate: function (startAngle, endAngle) {
        var self = this;
        var framesCount = 40;
        var angleDelta = endAngle - startAngle;
        var unit = angleDelta / framesCount;
        var offset = 0;
        while (framesCount-- > 0) {
            offset += unit;
            var angle = startAngle + offset;
            this.frames.push(function (i) {
                return function () {
                    self.draw(i);
                }
            }(angle));
        }
    },
    /**
     * 循环执行所有的帧，形成动画效果
     */
    animate: function () {
        var self = this;
        setInterval(function () {
            var frame = self.frames.shift();
            typeof frame == 'function' && frame.call(self);
        }, 1000 / 60);
    },
    /**
     * 速度转成弧度
     */
    speed2angle: function (speed) {
        var max = 300, min = 0;
        speed = speed > max ? max : speed < min ? min : speed;
        if (speed == max)
            return 300 * Math.PI / 180;

        if (speed == min)
            return 0;

        var speedDist = [0, 10, 30, 50, 70, 100, 140, 180, 220, 260, 300]
        var idx = 0;
        for (idx; idx < speedDist.length; idx++) {
            if (speed <= speedDist[idx])
                break;
        }

        // 计算偏移比例
        var total = speedDist[idx + 1] - speedDist[idx];
        var baseDeg = idx * 30;
        var delta = speed - speedDist[idx];
        var angle = ((delta / total) * 30 + baseDeg) * Math.PI / 180;

        return angle;
    },
    /**
     * 瞬时能耗转成弧度
     */
    pow2angle: function (power) {
        var max = 8000, min = 0;
        power = power > max ? max : power < min ? min : power;
        if (power == max)
            return 288 * Math.PI / 180;

        if (power == min)
            return 0;

        // this.props.angle * (2 * Math.PI / 360) * 80 * power / 8000
        var angle = Math.PI * power / 5000;
        return angle;
    },
    draw: function (angle) {
        angle = angle + Math.PI / 2;
        var ctx = this.getContext();
        var length = 170;
        ctx.clearRect(0, 0, this.props.width, this.props.height);
        ctx.beginPath();
        ctx.lineWidth = 6;
        ctx.strokeStyle = "#FF0000";
        ctx.moveTo(this.props.dot.x, this.props.dot.y);
        ctx.lineTo(this.props.dot.x + length * Math.cos(angle), this.props.dot.y + length * Math.sin(angle));
        ctx.stroke();
        ctx.closePath();
    },
    componentDidMount: function () {
        this.draw(0);
        this.animate();
        this.listen();
    },
    render: function () {
        var style = { position: 'absolute', left: 0, right: 0 };
        return (
            React.createElement("canvas", { ref: "canvas", height: this.props.height, width: this.props.width, style: style })
        );
    },
};

// 瞬时能耗指针
var PowerPointer = React.createClass({
    displayName: "PowerPointer",
    mixins: [Pointer],
    cache: { power: 0 },
    listen: function () {
        self = this;
        pubsub.sub("power", function (c) {
            return function (data) {
                c.updateUI(data.power);
            }
        }(self));
    },
    updateUI: function (power) {
        var startAngle = this.pow2angle(this.cache.power);
        var endAngle = this.pow2angle(power);
        this.prepareAnimate(startAngle, endAngle);

        this.cache.power = power;
    },
});

// 速度指针
var SpeedPointer = React.createClass({
    displayName: "SpeedPointer",
    mixins: [Pointer],
    cache: { speed: 0 },
    listen: function () {
        self = this;
        pubsub.sub("speed", function (c) {
            return function (data) {
                c.updateUI(data.speed);
            }
        }(self));
    },
    updateUI: function (speed) {
        var startAngle = this.speed2angle(this.cache.speed);
        var endAngle = this.speed2angle(speed);
        this.prepareAnimate(startAngle, endAngle);

        this.cache.speed = speed;
    },
});

// 瞬时电耗表盘
var PowerDial = React.createClass({
    displayName: "PowerDial",
    mixins: [Dial],

    /**
     *  绘制刻度
     */
    drawScale: function () {
        // 获取 canvas 对象
        var ctx = this.getContext();

        // 两个大刻度之间是 36 度，下面转为弧度
        var bigAngle = 36 * Math.PI / 180;

        // 每个大刻度平均分成 5 个小刻度
        var perBigAngle = 5;
        var smallAngle = bigAngle / perBigAngle;

        // 大刻度个数为 10
        var bigAngleCount = 10;
        var smallAngleCount = perBigAngle * bigAngleCount;

        // 画刻度
        for (var i = 0, angle = Math.PI / 2, tmp, len; i <= smallAngleCount; i++) {
            ctx.beginPath();
            text = i / perBigAngle

            // 每 5 个显示一个大刻度
            if (0 === i % perBigAngle) {
                ctx.lineWidth = 6;
                len = 12;
                ctx.strokeStyle = '#FFFFFF';
                ctx.fillStyle = '#FFFFFF';
            } else {
                ctx.lineWidth = 3;
                len = 6;
                ctx.strokeStyle = '#FFFFFF';
            }

            if (text > 5) {
                ctx.strokeStyle = '#00FF00';
                ctx.fillStyle = '#00FF00';
            }

            tmp = this.props.radius - 10;
            ctx.moveTo(
                this.props.dot.x + tmp * Math.cos(angle),
                this.props.dot.y + tmp * Math.sin(angle)
            );
            tmp -= len;

            // 刻度文字
            if (0 === i % perBigAngle) {
                var labelLen = tmp - 16;
                ctx.font = '20px Futura';
                if (text > 5) {
                    if (text < 10) {
                        ctx.fillStyle = '#00FF00';
                    }
                    text = 10 - text;
                }
                if (text < 10) {
                    ctx.fillText(
                        text,
                        this.props.dot.x + labelLen * Math.cos(angle) - 6,
                        this.props.dot.y + labelLen * Math.sin(angle) + 6);
                }
            }
            ctx.lineTo(this.props.dot.x + tmp * Math.cos(angle), this.props.dot.y + tmp * Math.sin(angle));
            ctx.stroke();
            ctx.closePath();

            angle += smallAngle;
        }

        //ctx.save();
        //ctx.font = '14px Futura';
        //ctx.rotate(45 * Math.PI/180);
        //ctx.fillText("1/min x 1000", this.props.dot.x - 40, this.props.dot.y);
        //ctx.restore();
    }
});

// 速度表盘
var SpeedDial = React.createClass({
    displayName: "SpeedDial",
    mixins: [Dial],

    /**
     *  绘制刻度
     */
    drawScale: function () {
        // 获取 canvas 对象
        var ctx = this.getContext();

        // 两个大刻度之间是 30 度，下面转为弧度
        var bigAngle = 30 * Math.PI / 180;

        // 每个大刻度平均分成 4 个小刻度
        var perBigAngle = 4;
        var smallAngle = bigAngle / perBigAngle;

        // 大刻度个数为 10
        var bigAngleCount = 10;
        var smallAngleCount = perBigAngle * bigAngleCount;

        // 画刻度
        var bigText = [0, 10, 30, 50, 70, 100, 140, 180, 220, 260, 300]
        var smallText = [20, 40, 60, 80, 120, 160, 200, 240, 280]
        var bigTextIdx = 0, smallTextIdx = 0;
        for (var i = 0, angle = Math.PI / 2, tmp, len; i <= smallAngleCount; i++) {
            // 第一和第三个刻度不显示
            if (i == 1 || i == 3) {
                angle += smallAngle;
                continue;
            }
            ctx.beginPath();

            // 每 4 个显示一个大刻度
            if (0 === i % 4) {
                ctx.lineWidth = 6;
                len = 12;
                ctx.strokeStyle = '#FFFFFF';
                ctx.fillStyle = '#FFFFFF';
            } else {
                ctx.lineWidth = 3;
                len = 6;
                ctx.strokeStyle = '#FFFFFF';
            }

            tmp = this.props.radius - 10;
            ctx.moveTo(
                this.props.dot.x + tmp * Math.cos(angle),
                this.props.dot.y + tmp * Math.sin(angle)
            );
            tmp -= len;
            if (i == 8 || i == 12 || i == 23) {
                ctx.strokeStyle = 'rgb(255, 0, 0)';
                ctx.fillStyle = 'rgb(255, 0, 0)';
            }

            ctx.lineTo(this.props.dot.x + tmp * Math.cos(angle), this.props.dot.y + tmp * Math.sin(angle));
            ctx.stroke();
            ctx.closePath();
            ctx.strokeStyle = '#FFFFFF';
            ctx.fillStyle = '#FFFFFF';

            // 大刻度文字
            if (0 === i % 4) {
                var _tt = tmp - 16;
                ctx.font = '20px Futura';
                var bigVal = bigText[bigTextIdx];
                var offset_x = 0, offset_y = 0;
                if (bigVal > 100 && bigVal < 200) {
                    offset_x = -10;
                } else if (bigVal > 200) {
                    offset_x = -20;
                }
                ctx.fillText(
                    bigText[bigTextIdx],
                    this.props.dot.x + offset_x + _tt * Math.cos(angle) - 6,
                    this.props.dot.y + offset_y + _tt * Math.sin(angle) + 6);
                bigTextIdx += 1;
            }
            // 小刻度文字
            if (i > 4 && 2 === i % 4) {
                var _tt = tmp - 16;
                var smallVal = smallText[smallTextIdx];
                var s_offset_x = 0, s_offset_y = 0;
                if (smallVal >= 160) {
                    s_offset_x = -10;
                }
                ctx.font = '14px Futura';
                ctx.fillText(
                    smallText[smallTextIdx],
                    this.props.dot.x + s_offset_x + _tt * Math.cos(angle) - 6,
                    this.props.dot.y + s_offset_y + _tt * Math.sin(angle) + 6);
                smallTextIdx += 1;
            }

            angle += smallAngle;
        }
    }
});

(function (w) {
    // 应用组件
    React.render(
        React.createElement("div", null,
            React.createElement("div", { className: "power" },
                React.createElement(PowerDial, null),
                React.createElement(PowerPointer, null)
            ),
            React.createElement("div", { className: "speed" },
                React.createElement(SpeedDial, null),
                React.createElement(SpeedPointer, null)
            )
        ),
        document.body
    );
    var currentIdx = 0;
    var maxLength = 0;
    function feedData(data, i) {
        console.log(data[i])
        v = data[i]
        pubsub.pub('speed', { speed: v.speed });
        pubsub.pub('power', { power: v.power });


        currentIdx = i + 1;
        setTimeout(feedData, 1000, data, currentIdx % maxLength);
    }

    fetch('/sample.json')
        .then(response => response.json())
        .then(data => {
            maxLength = data.length;
            setTimeout(feedData, 1000, data, currentIdx);
        });
})(window);

