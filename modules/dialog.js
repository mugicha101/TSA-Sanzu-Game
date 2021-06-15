import * as ce from "./canvasExtension.js";
import { MainLoop, zoom } from "./main.js";
import { Player } from "./player.js"
import { Trigger } from "./stage.js";
import { Collision } from "./collisions.js";
import { Sound } from "./audio.js";
export { Char, Dialog, InteractionText, CreditText};
const canvas = ce.canvas;
const c = canvas.getContext("2d", { alpha: false });

class Char {
    static charDict = {};

    static dim = [15*8, 23*8];

    static initLetters() {
        const letterArr = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', [',','com'], ['.','dot'], ["'", 'app'], ['“', 'qtnL'], ['"', 'qtnN'], ['”', 'qtnR'], ['!','xpnt'], ['?','qmark'], [':','col'], [';','scol'], ['-','dash'], ['/','slash']];

        for (let i in letterArr) {
            let data = letterArr[i];
            let letter;
            let pathId;
            if (typeof data === "string") {
                letter = data;
                pathId = data;
            } else {
                letter = data[0];
                pathId = data[1];
            }
            
            let img = new Image();
            img.src = `../graphics/text/${pathId}.png`;
            Char.charDict[letter] = new Char(img);
        }

        Dialog.contMsgImg = new Image();
        Dialog.contMsgImg.src = "../graphics/text/continue.png";

        Dialog.picImgs = ["player", "narration", "note", "mori", "core"];
        for (let i = 0; i < 5; i++) {
            let name = Dialog.picImgs[i];
            Dialog.picImgs[i] = new Image();
            Dialog.picImgs[i].src = "../graphics/dialogPics/" + name + ".png";
        }
    }

    constructor(maskImage) {
        this.maskImage = maskImage;
        this.loaded = false;
        let self = this;

        // set interval to wait for image to initialize
        const load = setInterval(function() {
            if (self.maskImage.complete) {
                clearInterval(load);
                // create normal letter for dialog text
                let mi = self.maskImage;
                let dim = Char.dim;
                self.normCanvas = ce.createCanvas(dim[0], dim[1]);
                let ctx = self.normCanvas.getContext('2d');
                ctx.drawImage(mi, 0, 0);
                ctx.globalCompositeOperation = "source-in";
                ctx.fillStyle = "rgb(0,0,0)";
                ctx.fillRect(0, 0, dim[0], dim[1]);

                // create normal letter for interaction text
                self.normCanvas2 = ce.createCanvas(dim[0], dim[1]);
                ctx = self.normCanvas2.getContext('2d');
                ctx.drawImage(mi, 0, 0);
                ctx.globalCompositeOperation = "source-in";
                ctx.fillStyle = "rgb(255,255,255)";
                ctx.fillRect(0, 0, dim[0], dim[1]);

                // create important letter canvas (alternate color)
                self.altCanvas = ce.createCanvas(dim[0], dim[1]);
                ctx = self.altCanvas.getContext('2d');
                ctx.drawImage(mi, 0, 0);
                ctx.globalCompositeOperation = "source-in";
                ctx.fillStyle = "rgb(255,0,0)";
                ctx.fillRect(0, 0, dim[0], dim[1]);

                self.loaded = true;
            }
        })
    }
}

const CreditText = {
    lines: [],
    canvas: null,
    createCanvas: function(completionCycleTime) {
        let seconds = completionCycleTime/60;
        let timeArr = [Math.floor(seconds/3600), Math.floor(seconds/60)%60, Math.floor(seconds%60)];
        let completionTime = "";
        for (let i = 0; i < 3; i++) {
            let text = timeArr[i].toString();
            while (text.length < 2) {
                text = "0" + text;
            }
            completionTime += text;
            if (i != 2) completionTime += ":";
        }
        this.lines = [
            "{i}Game Complete{/i}",
            "",
            "",
            "Thank you for playing!",
            "",
            `Completion Time: {i}${completionTime}{/i}`,
            "",
            "",
            "{i}Click to Continue{/i}"
        ];
        const scale = 0.3;
        this.canvas = ce.createCanvas(ce.screenDim[0]/scale, this.lines.length*Char.dim[1]*1.2*scale);
        let ctx = this.canvas.getContext('2d');
        ctx.transformCanvas(scale, 0, 0, 0);
        c.fillStyle = "rgb(0,0,0)";
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        for (let i = 0; i < this.lines.length; i++) {
            let line = Dialog.formatText(this.lines[i].toUpperCase());
            // draw text
            for (let j = 0; j < line.length; j++) {
                let data = line[j];
                if (data.letter == ' ') continue;
                let char = Char.charDict[data.letter];
                let offset = [0,0];
                if (data.shake) {
                    for (let k = 0; k < 2; k++) {
                        offset[k] = data.noiseObjArr[i].noise2D(MainLoop.cycles/18*((data.important)? 2 : 1), 0)*0.2;
                    }
                }
                if (char != undefined && char.loaded) {
                    ctx.drawImage(((data.important)? char.altCanvas : char.normCanvas2), this.canvas.width/2+(j-(line.length)/2)*Char.dim[0]*1.2, i*Char.dim[1]*1.2);
                }
            }
        }
    }
}

const InteractionText = {
    interactionTextArr: [],
    interactionText: "",
    ignoreNextUpdate: false,
    calc: function() {
        // update interaction text alpha
        for (let i = 0; i < this.interactionTextArr.length; i++) {
            let data = this.interactionTextArr[i];
            data.alpha += (1-data.alpha)*0.25;
        }

        // check for new interaction text
        if (this.ignoreNextUpdate) {
            this.ignoreNextUpdate = false;
            return;
        }
        if (Dialog.activeDialog == null && !Player.farSightMode) {
            for (let id in Trigger.objDict) {
                let t = Trigger.objDict[id];
                if (!t.enabled) continue;
                if (t.passive) continue;
                for (let c in t.colArr) {
                    let col = t.colArr[c];
                    col.enabled = true;
                    if (Collision.isTouching(Player.hc, col).overlap) {
                        if (t.interactionText != this.interactionText) {
                            // change to new interaction text
                            this.interactionText = t.interactionText;
                            this.interactionTextArr = Dialog.formatText(t.interactionText);
                        }
                        col.enabled = false;
                        return;
                    }
                    col.enabled = false;
                }
            }
            // remove interaction text
            this.interactionText = "";
            this.interactionTextArr = [];
        } else {
            const it = (Player.farSightMode)? "PRESS {I}X{/I} TO TOGGLE FARSIGHT MODE" : "";
            if (this.interactionText != it) {
                // change to new interaction text
                this.interactionText = it;
                this.interactionTextArr = Dialog.formatText(it);
            }
        }
    },

    setText: function(text) {
        this.ignoreNextUpdate = true;
        text = text.toUpperCase();
        if (text === this.interactionText)
            return;
        this.interactionText = text;
        this.interactionTextArr = Dialog.formatText(text);
    },

    draw: function() {
        // setup transformations
        c.resetTrans();
        const scale = 0.2;
        c.transformCanvas(scale, 0, ce.screenDim[0]/2 - (this.interactionTextArr.length)/2 * Char.dim[0] * 1.2 * scale, ce.screenDim[1] - 150);

        // draw text
        for (let i = 0; i < this.interactionTextArr.length; i++) {
            let data = this.interactionTextArr[i];
            if (data.letter == ' ') continue;
            let char = Char.charDict[data.letter];
            let offset = [0,0];
            if (data.shake) {
                for (let i = 0; i < 2; i++) {
                    offset[i] = data.noiseObjArr[i].noise2D(MainLoop.cycles/18*((data.important)? 2 : 1), 0)*0.2;
                }
            }
            if (char != undefined && char.loaded) {
                if (data.alpha < 1) {
                    c.globalAlpha = data.alpha;
                }
                c.drawImage(((data.important)? char.altCanvas : char.normCanvas2), i*Char.dim[0]*1.2, Char.dim[1]*1.2);
                if (data.alpha < 1) {
                    c.globalAlpha = 1;
                }
            }
        }
    }
}

class Dialog {
    static queue = [];

    static activeDialog = null;

    static contMsgDim = [600*3, 72*3];

    static contMsgImg = null;

    static picImgs = null;

    static nextDialog() {
        if (this.activeDialog == null) return false;
        if (this.activeDialog.shownText === this.activeDialog.textArr.length) {
            if (this.activeDialog.closeFunct != null) {
                this.activeDialog.closeFunct();
            }
            this.activeDialog = null;
            this.calc(true);
        } else {
            this.activeDialog.shownText = this.activeDialog.textArr.length;
        }
        return true;
    }

    static calc(queueAdvanceOnly=false) {
        if (this.activeDialog == null && this.queue.length > 0) {
            // add first dialog in queue as active dialog
            this.activeDialog = this.queue[0];
            this.queue.splice(0,1);
            if (this.activeDialog.initFunct != null) {
                this.activeDialog.initFunct();
            }

            // reset active dialog
            let d = this.activeDialog;
            d.shownText = 0;
            d.cd = 0;
            d.done = false;
            d.doneTime = 0;
            d.contAlpha = 0.0;
            for (let i in d.textArr) {
                d.textArr[i].alpha = 0;
            }
        }
        if (queueAdvanceOnly) return;
        if (this.activeDialog != null) {
            let d = this.activeDialog;
            // increment shown text amount
            if (d.cd <= 0) {
                if (d.shownText === d.textArr.length) {
                    d.done = true;
                } else {
                    d.shownText += 1;
                    Sound.sounds[`tap${Math.floor(Math.random()*3)+1}`].play();
                }
                if (d.textArr[d.shownText-1].letter === "newline") {
                    d.cd = 0;
                } else {
                    d.cd = d.baseTextDelay
                    if (d.textArr[d.shownText-1].shake)
                        d.cd *= 2;
                    if (['!', '.', '?'].includes(d.textArr[d.shownText-1].letter))
                        d.cd *= 10;
                }
            } else d.cd -= 1;

            // increase alpha on shown text
            for (let i = 0; i < d.shownText; i++) {
                let data = d.textArr[i];
                if ([' ', "newline"].includes(data.letter)) continue;
                data.alpha += 0.1;
                if (data.alpha > 1) data.alpha = 1;
            }

            // increase alpha on continue message
            if (d.done) {
                d.doneTime++;
            }
            if (d.doneTime >= 120) {
                d.contAlpha += (1-d.contAlpha)*0.05
            } else {
                d.contAlpha = 0;
            }
        }
    }

    static draw() {
        if (this.activeDialog == null) return;
        c.resetTrans();
        let d = this.activeDialog;
        let pic = this.picImgs[this.activeDialog.type];
        let picScale = 0.125
        let picSize = pic.width*picScale;
        let bottomGap = 20;
        let scale = (ce.screenDim[0]-picSize)/d.canvas.width;
        c.transformCanvas(scale, 0, picSize, 0);
        c.drawImage(d.drawDialogue(), 0, ce.screenDim[1]/scale-d.canvas.height-bottomGap);
        c.resetTrans();
        c.transformCanvas(picScale, 0, 0, ce.screenDim[1]-pic.height*picScale);
        c.drawImage(pic, 0, -bottomGap);
    }
    
    constructor(text, type = 0, baseTextDelay = 2, initFunct = null, closeFunct = null) {
        /* types:
        0 = player speaking
        1 = narration/controls
        2 = note
        */
        this.type = type;
        this.shownText = 0;
        this.cd = 0;
        this.done = false;
        this.baseTextDelay = baseTextDelay;
        this.contAlpha = 0;
        this.doneTime = 0;
        this.initFunct = initFunct;
        this.closeFunct = closeFunct;

        text = text.toUpperCase();
        /* Effect Format:
        {i}text{/i} makes text important
        {s}text{/s} makes text shake

        effects can overlap
        */
        let textArr = Dialog.formatText(text);
        this.textArr = textArr;

        // text wrapping
        const maxLineLen = 50;
        let lineLen = 0;
        let nlIndexCanidate = 0;
        let lineCount = 1;
        textArr.push({letter: ' '});
        for (let i = 0; i < textArr.length; i++) {
            let l = textArr[i].letter;
            if (l === ' ') {
                // end of segment, check if need to move to new line
                lineLen++;
                if (lineLen-1 > maxLineLen) {
                    textArr[nlIndexCanidate] = {letter: 'newline'};
                    lineLen = i-nlIndexCanidate;
                    lineCount++;
                }
                nlIndexCanidate = i;
            } else {
                lineLen++;
            }
        }
        textArr.pop();

        // create canvas
        this.canvas = ce.createCanvas(maxLineLen*Char.dim[0]*1.2+200, lineCount*Char.dim[1]*1.2+200+Dialog.contMsgDim[1])
        this.ctx = this.canvas.getContext('2d');
        let ctx = this.ctx;
    }

    static formatText(text) {
        let textArr = [];
        this.textArr = textArr;
        let formatMode = false;
        let enablingFormat = false;
        let formatId = "";
        let important = false;
        let shake = false;
        for (let i in text) {
            let t = text[i];
            if (formatMode) {
                if (t === "}") {
                    formatMode = false;
                    switch(formatId) {
                        case "I":
                            important = enablingFormat;
                            break;
                        case "S":
                            shake = enablingFormat;
                            break;
                    }
                } else if (t === "/") {
                    enablingFormat = false;
                } else {
                    formatId += t;
                }
            } else {
                if (t === "{") {
                    formatMode = true;
                    enablingFormat = true;
                    formatId = "";
                } else {
                    let data = {
                        letter: t,
                        important: important,
                        shake: shake,
                        alpha: 0
                    }
                    if (shake) data.noiseObjArr = [new SimplexNoise(), new SimplexNoise()];
                    textArr.push(data)
                }
            }
        }
        return textArr;
    }

    drawDialogue() {
        // clear canvas
        let dCanvas = this.canvas;
        let dCtx = this.ctx;
        dCtx.resetTrans();

        // draw bg + border
        let grad = dCtx.createLinearGradient(0,Dialog.contMsgDim[1],0,dCanvas.height);
        switch(this.type) {
            case 4: // core
                grad.addColorStop(0,"rgb(255,0,0)")
                grad.addColorStop(1,"rgb(128,0,0)")
                break;
            case 3: // mori
                grad.addColorStop(0,"rgb(128,0,255)")
                grad.addColorStop(1,"rgb(64,0,128)")
                break;
            case 2: // notes
                grad.addColorStop(0,"rgb(255,128,0)")
                grad.addColorStop(1,"rgb(128,64,0)")
                break;
            case 1: // narration/controls
                grad.addColorStop(0,"rgb(128,128,128)")
                grad.addColorStop(1,"rgb(64,64,64)")
                break;
            default: // player speaking
                grad.addColorStop(0,"rgb(0,0,255)")
                grad.addColorStop(1,"rgb(0,255,255)")
                break;
        }
        dCtx.fillStyle = grad; // border color
        dCtx.fillRect(0, Dialog.contMsgDim[1], dCanvas.width, dCanvas.height-Dialog.contMsgDim[1]);

        grad = dCtx.createLinearGradient(50,50+Dialog.contMsgDim[1],50,dCanvas.height-100);
        grad.addColorStop(0,"rgb(255,255,255)")
        grad.addColorStop(1,"rgb(220,220,220)")
        dCtx.fillStyle = grad; // bg color
        dCtx.fillRect(50, 50+Dialog.contMsgDim[1], dCanvas.width-100, dCanvas.height-100-Dialog.contMsgDim[1]);

        // draw text
        dCtx.transformCanvas(1,0,100,100+Dialog.contMsgDim[1])
        let pos = [0,0];
        for (let i in this.textArr) {
            if (i >= this.shownText) break;
            if (this.textArr[i].letter === "newline") {
                pos[0] = 0;
                pos[1] += 1;
            } else {
                if (this.textArr[i].letter != ' ') {
                    let data = this.textArr[i];
                    let char = Char.charDict[data.letter];
                    let offset = [0,0];
                    if (data.shake) {
                        for (let i = 0; i < 2; i++) {
                            offset[i] = data.noiseObjArr[i].noise2D(MainLoop.cycles/18*((data.important)? 2 : 1), 0)*0.2;
                        }
                    }
                    if (char != undefined && char.loaded) {
                        if (data.alpha < 1) {
                            dCtx.globalAlpha = data.alpha;
                        }
                        dCtx.drawImage(((data.important)? char.altCanvas : char.normCanvas), (pos[0]+offset[0])*Char.dim[0]*1.2, (pos[1]+offset[1])*Char.dim[1]*1.2+16);
                        if (data.alpha < 1) {
                            dCtx.globalAlpha = 1;
                        }
                    }
                }
                pos[0] += 1;
            }
        }

        // continue message
        if (this.contAlpha > 0) {
            dCtx.resetTrans();
            dCtx.transformCanvas(3,0,dCanvas.width-Dialog.contMsgDim[0],0);
            dCtx.globalAlpha = this.contAlpha;
            dCtx.drawImage(Dialog.contMsgImg, 0, 0);
            dCtx.fillStyle = "rgb(128,255,255)";
            dCtx.globalCompositeOperation = "lighten";
            dCtx.globalAlpha *= Math.sin(MainLoop.cycles/60*Math.PI)/4+0.25;
            dCtx.fillRect(0,0,Dialog.contMsgDim[0]/3,Dialog.contMsgDim[1]/3);
            dCtx.globalCompositeOperation = "source-over";
            dCtx.globalAlpha = 1;
        }

        // return canvas
        return dCanvas;
    }

    addToQueue() {
        Dialog.queue.push(this);
    }

    static call(text, type, speed, initFunct, closeFunct) {
        let d = new Dialog(text, type, speed, initFunct, closeFunct);
        d.addToQueue();
    }
}