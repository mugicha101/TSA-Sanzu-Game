/*
BUTTON SYSTEM
*/

import {MainLoop} from "./main.js";
import {MapObject, Graphic} from "./mapObj.js"
import {Player, PlayerProj} from "./player.js"
import {Collision, HitBox, HitCircle} from './collisions.js';
import {Sound} from './audio.js';
import * as ce from "./canvasExtension.js";

export class Button {
    static objDict = {}
    static colors = {
        red: "r",
        green: "g",
        blue: "b"
    }
    static nextId = 0;

    static updateButtons() {
        for (let id in Button.objDict) {
            let b = Button.objDict[id];
            let preUpdatePressed = b.pressed;
            b.update();
            if (preUpdatePressed != b.pressed) {
                if (b.pressed) {
                    Sound.sounds.buttonDown.play(b.pos);
                } else {
                    Sound.sounds.buttonUp.play(b.pos);
                }
            }
        }
    }

    constructor(pos, signalId, color, scale = 1) {
        this.pos = pos;
        this.signalId = signalId;
        this.color = color;
        this.pressed = false;
        this.scale = scale*0.75;
        this.id = Button.nextId;
        Button.nextId++;
        Button.objDict[this.id] = this;
        this.mo = new MapObject(pos, [
            new Graphic("button/"+color, ["floor"], ".png", this.scale, 3, 0, [-256*this.scale,-256*this.scale], 1, 0)
        ], [], [-256*this.scale, -256*this.scale, 256*this.scale, 256*this.scale]);
    }

    update() {
        // check if touching player or player orb
        function updateCollision(self) {
            let bRad = 216*self.scale
            if (ce.distance(self.pos, Player.pos) <= bRad+Player.hc.radius) {
                self.pressed = true;
                return;
            }
            for (let i in PlayerProj.projArr) {
                let p = PlayerProj.projArr[i];
                if (p.height > 0) continue;
                if (ce.distance(self.pos, ce.flipY(p.pos)) <= bRad+35) {
                    self.pressed = true;
                    return;
                }
            }
            self.pressed = false;
        }
        updateCollision(this);
        if (this.pressed) {
            this.mo.gArr[0].frameIndex = 1 + Math.floor(MainLoop.cycles/5) % 2;
        } else {
            this.mo.gArr[0].frameIndex = 0;
        }
    }
}

export class Bridge {
    static objDict = {}
        static colors = {
        red: "r",
        green: "g",
        blue: "b"
    }
    static nextId = 0;

    static bridgeCalc = function() {
        for (let brId in Bridge.objDict) {
            let br = Bridge.objDict[brId];
            if (br.permaOn) {
                br.on = true;
                return;
            } else {
                let on = false;
                for (let buId in Button.objDict) {
                    let bu = Button.objDict[buId];
                    if (br.signalId === bu.signalId && bu.pressed) {
                        on = true;
                        break;
                    }
                }
                br.on = on;
            }
        }
    }

    #on = false;
    constructor(pos, signalId, color, scale = 1) {
        this.pos = pos;
        this.signalId = signalId;
        this.permaOn = (signalId == null) // if signalId is null, bridge is always on
        this.color = color;
        this.pressed = false;
        this.scale = scale*0.60;
        this.id = Bridge.nextId;
        Bridge.nextId++;
        Bridge.objDict[this.id] = this;
        this.barrierHB = new HitBox([(-32+8)*8*this.scale,(-64+16)*8*this.scale], [(32-8)*16*this.scale,(128-32)*8*this.scale]);
        this.barrierHB.river = true;
        this.floorG = new Graphic("bridge/"+color, ["floor"], ".png", this.scale, 2, 0, [-256*this.scale,(-512+64)*this.scale], 1, 0)
        this.mo = new MapObject(pos, [
            this.floorG,
            new Graphic("bridge/sides", ["wall"], ".png", this.scale, 1, 0, [-256*this.scale,(-512+64)*this.scale], 1, null, false)
        ], [
            this.barrierHB,
            // left side
            new HitBox([(-32)*8*this.scale, (-64+12)*8*this.scale], [(8)*8*this.scale, (128-26)*8*this.scale]),
            new HitCircle([(-32+4)*8*this.scale, (-64+12)*8*this.scale], 4*8*this.scale, true),
            new HitCircle([(-32+4)*8*this.scale, (64-14)*8*this.scale], 4*8*this.scale, true),
            // right side
            new HitBox([(32-8)*8*this.scale, (-64+12)*8*this.scale], [(8)*8*this.scale, (128-28)*8*this.scale]),
            new HitCircle([(32-4)*8*this.scale, (-64+12)*8*this.scale], 4*8*this.scale, true),
            new HitCircle([(32-4)*8*this.scale, (64-14)*8*this.scale], 4*8*this.scale, true)
        ], [
            -256*this.scale,
            (-512+64)*this.scale,
            256*this.scale,
            (512+64)*this.scale
        ]);
        this.on = false;
    }

    get on() {
        return this.#on;
    }
    set on(on) {
        if (this.#on != on) {
            this.floorG.frameIndex = (on)? 1 : 0;
            this.barrierHB.enabled = !on;
            this.#on = on;
        }
    }
}