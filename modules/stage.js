import {MainLoop, Draw, zoom, changeZoom} from './main.js';
import { Graphic, MapObject, BVH } from './mapObj.js';
import {Player, PlayerProj} from "./player.js"
import {Collision, HitBox, HitCircle} from './collisions.js';
import * as ce from './canvasExtension.js';
import {MBullet, spawnRing, spawnBullet} from "./bullets.js";
import * as mod from "./bulletMods.js";
import {Enemy} from "./enemy.js";
import {bossAttack, killMiniSpires} from './bossAttacks.js';
import {Button, Bridge} from "./button.js";
import {SaveStatue, Save, RecallStatue} from "./save.js";
import {Music, Sound} from "./audio.js";
import {Dialog, InteractionText} from "./dialog.js";
import * as forest from './forest.js';
import * as inp from './input.js';
const canvas = ce.canvas
const c = canvas.getContext("2d", { alpha: false })
export let bossBarEnemyId = null // null = no active boss
export let whiteOutAlpha = 0;

/* layers:

roof
wall
lighting
object
floor

*/

export function stageCalc() {
    // will be replaced by active stage's stageCalc function
}

export function stageBullets() {
    // will be replaced by active stage's stageBullets function
}

export function stageDraw() {
    // will be replaced by active stage's stageDraw function
}

export const Stage = {
    clearStage: function() {
        whiteOutAlpha = 0;

        stageCalc = function() {}
        stageBullets = function() {}
        stageDraw = function() {}

        Save.saveFunctArr = [];
        Save.loadFunctArr = [];

        Draw.grassVariant = 0;

        // prevent weird mouse down on load bug (happens when alert box for choosing stage shows when debug mode is enabled)
        inp.inputs.leftClick.pressed = false;
        
        // delete all collisions (aside from player)
        for (let id in Collision.objDict) {
            if (id === Player.hcIdStr) continue;
            Collision.objDict[id].remove();
        }

        // delete all enemies
        for (let id in Enemy.eDict) {
            Enemy.eDict[id].remove();
        }

        // delete yyOrbs
        PlayerProj.projArr = [];
        PlayerProj.projCount = 0;
        PlayerProj.reserveCount = 0;
        PlayerProj.thrownCount = 0;
        /*
        for (let i in PlayerProj.projArr) {
            PlayerProj.projArr[i].pos = ce.move([0,0], Math.random()*360, Math.random()*50);
            PlayerProj.projArr[i].thrown = false;
        }
        */

        // delete all notes
        noteArr = [];

        // delete all bullets
        MBullet.bArr = [];

        // delete all buttons
        Button.objDict = {};

        // delete all bridges
        Bridge.objDict = {};

        // delete all save statues
        SaveStatue.ssDict = {};

        // delete all recall statues
        RecallStatue.rsDict = {};

        // delete mapobjects
        MapObject.objDict = {};
        MapObject.unloadedObjDict = {};

        // graphic reset
        Graphic.gCount = 0;

        // delete all triggers
        Trigger.objDict = {};

        // update BVH
        BVH.topNode = new BVH([]);
    },
    loadStage: function(id = '') {
        // unload active stage
        Stage.clearStage();

        // reset player location
        Player.pos = [0,0];
        Player.camPosTarget = [0,0];
        Player.offset = [0,0];
        Player.offsetTarget = [0,0];
        Player.moveVelo = [0,0];
        Player.shakeMulti = 0;
        Player.disableControl = false;
        whiteOutAlpha = 0;

        // load new stage
        console.log("loading stage '" + id + "'");
        switch(id) {
            case "0":
                loadStageTest();
                break;
            case "1":
                loadStageShrine();
                break;
            case "2":
                loadStageCity();
                break;
            case "3":
                loadStageForest();
                break;
            default:
                console.log("fail")
                throw new Error("No stage by the name " + id);
                break;
        }
        console.log("gImages:", Object.keys(Graphic.imgDict).length, "graphic count:", Graphic.gCount)

        Player.camPos = [Player.camPosTarget[0], Player.camPosTarget[1]];
        for (let id in MapObject.objDict) {
            MapObject.objDict[id].updateColPos();
        }
        BVH.create();
        //MapObject.unloadTransfer();
        Save.save();
    }
}

export class Trigger {
    static objDict = {};
    static nextId = 0;

    static triggerCalc(passive) {
        for (let id in Trigger.objDict) {
            let t = Trigger.objDict[id];
            try {
                if (!t.enabled) continue;
                if (passive != t.passive) continue;
                for (let c in t.colArr) {
                    let col = t.colArr[c];
                    col.enabled = true;
                    if (Collision.isTouching(Player.hc, col).overlap) {
                        col.enabled = false;
                        t.triggerFunct();
                        if (!t.multiUse) {
                            t.enabled = false;
                        }
                        if (!passive) return;
                        break;
                    }
                    col.enabled = false;
                }
            } catch(e) {
                console.log("trigger error:", e);
            }
        }
    }
    
    constructor(colArr, triggerFunct, passive=true, multiUse=true, interactionText="") {
        this.id = Trigger.nextId;
        this.passive = passive;
        for (let i in colArr) {
            colArr[i].enabled = false;
            colArr[i].trigger = true;
            colArr[i].tObj = this;
        }
        this.colArr = colArr;
        this.triggerFunct = triggerFunct;
        this.multiUse = multiUse;
        this.enabled = true;
        this.interactionText = ((interactionText == "")? " " : interactionText).toUpperCase();
        Trigger.objDict[this.id] = this;
        Trigger.nextId++;
    }

    
}

export const StageTrans = {
    transCycles: null,
    transStage: null,
    stageImg: new Image(),
    stageNum: {
        0: new Image(),
        1: new Image(),
        2: new Image(),
        3: new Image(),
    },

    init: function() {
        this.stageImg.src = "../graphics/stage_trans/stage.png";
        this.stageNum["0"].src = "../graphics/stage_trans/1.png";
        this.stageNum["1"].src = "../graphics/stage_trans/1.png";
        this.stageNum["2"].src = "../graphics/stage_trans/2.png";
        this.stageNum["3"].src = "../graphics/stage_trans/3.png";
    },

    startTrans: function(stage) {
        this.transCycles = 0;
        this.transStage = stage;
    },

    calc: function() {
        if (this.transCycles == null) return;
        this.transCycles++;
        if (this.transCycles === 210) {
            Stage.clearStage();
            Stage.loadStage(this.transStage);
        }
        if (this.transCycles === 420) {
            this.transCycles = null;
        }
    },

    draw: function() {
        if (this.transCycles == null) return;
        c.fillStyle = "rgb(0,0,0)";
        c.resetTrans();
        if (this.transCycles < 120) {
            c.globalAlpha = this.transCycles/120;
        } else if (this.transCycles > 300) {
            c.globalAlpha = 1 - (this.transCycles - 300)/120;
        }
        c.fillRect(0, 0, ce.screenDim[0]/zoom, ce.screenDim[1]/zoom);
        const scale = 0.25;
        if (this.transCycles < 120) {
            c.globalAlpha = 0;
        } else if (this.transCycles < 180) {
            c.globalAlpha = (this.transCycles - 120)/60;
        } else if (this.transCycles < 240) {
            c.globalAlpha = 1;
        } else if (this.transCycles < 300) {
            c.globalAlpha = 1-(this.transCycles - 240)/60;
        } else {
            c.globalAlpha = 0;
        }
        c.transformCanvas(scale, 0, ce.screenDim[0]*0.2, ce.screenDim[1]/2)
        c.drawImage(this.stageImg, 0, -this.stageImg.height/2 + Math.sign(this.transCycles - 210) * (Math.abs(this.transCycles - 210))**1.5)
        c.drawImage(this.stageNum[this.transStage],ce.screenDim[0]*0.5/scale, -this.stageImg.height/2 - Math.sign(this.transCycles - 210) * (Math.abs(this.transCycles - 210))**1.5)
        c.globalAlpha = 1;
    }
}

class Tile {
    constructor(graphics=[], colObjs=[], aabb=[0,0,0,0]) {
        this.gArr = graphics;
        this.colArr = colObjs;
        this.aabb = aabb;
    }
}

function buildTileMap(tPos, tileDim, tileDict, mapLayers, tileIdLen=1) {
    // check if all layers have same dim
    let mapDim = [mapLayers[0][0].length/tileIdLen, mapLayers[0].length]
    for (let i = 0; i < mapLayers.length; i++) {
        if (mapLayers[i][0].length/tileIdLen != mapDim[0] || mapLayers[i].length != mapDim[1]) {
            console.log("ERROR LOADING TILE MAP: layer dimensions don't match");
            return;
        }
    }
    let moArr = [];

    // build map
    let blankStr = "";
    for (let s = 0; s < tileIdLen; s++) {
        blankStr += " "
    }
    for (let l = 0; l < mapLayers.length; l++) {
        for (let y = 0; y < mapDim[1]; y++) {
            for (let x = 0; x < mapDim[0]; x++) {
                let id = mapLayers[l][y].substring(x*tileIdLen,(x+1)*tileIdLen);
                /*
                let pos = [
                    (x-(mapDim[0]-1)/2)*tileDim[0],
                    (-y-1+(mapDim[1]-1)/2)*tileDim[1]
                ];
                */
                let pos = [
                    (x*tileDim[0]+tPos[0]),
                    ((mapDim[1]-y-1)*tileDim[1]+tPos[1])
                ]
                if (id != blankStr && id in tileDict) {
                    let colArr = [];
                    let gArr = [];
                    let aabb = [];
                    let tile = tileDict[id];
                    for (let h = 0; h < tile.gArr.length; h++) {
                        let g = tileDict[id].gArr[h].clone();
                        gArr.push(g);
                    }
                    for (let h = 0; h < tile.colArr.length; h++) {
                        let hb = tileDict[id].colArr[h].clone();
                        colArr.push(hb);
                    }
                    for (let i = 0; i < 4; i++) {
                        aabb[i] = tile.aabb[i]//+pos[i%2];
                    }
                    moArr.push(new MapObject(pos, gArr, colArr, aabb))
                }
            }
        }
    }

    // remove duplicate hitboxes REMOVED BECAUSE MULTIPLE MAPOBJECTS
    /*
    for (let i in colArr) {
        for (let j in colArr) {
            if (i === j) continue;
            let colA = colArr[i];
            let colB = colArr[j];
            if (colA.removed || colB.removed) continue;
            if (colA.type != colB.type) continue;
            if (colA.pos[0] !== colB.pos[0] || colA.pos[1] !== colB.pos[1]) continue;
            if (colA.type === "box") {
                if (colA.dim[0] === colB.dim[0] && colA.dim[1] === colB.dim[1]) {
                    colB.removed = true;
                }
            } else if (colA.type === "circle") {
                if (colA.radius === colB.radius) {
                    colB.removed = true;
                }
            }
        }
    }
    for (let i = colArr.length-1; i >= 0; i--) {
        if (!colArr[i].removed) continue;
        colArr[i].remove();
        colArr.splice(i,1);
    }
    */

    // return map object
    return {
        //mo: new MapObject([tPos[0],tPos[1]], gArr, colArr, [0, 0, mapDim[0]*tileDim[0], mapDim[1]*tileDim[1]]),
        moArr: moArr,
        pos: [tPos[0], tPos[1]], // bottom left corner
        dim: [mapDim[0]*tileDim[0], mapDim[1]*tileDim[1]] // pixel dimensions
    }
}

export let noteArr = [];
function spawnNote(pos, label="blank note", noteLines=[], doneFunct = function() {}) {
    let mo = new MapObject(pos, [new Graphic("note", ["floor"], ".png", 0.5, 2, 5, [-12*4, -12*4])], [], [-192*0.25, -192*0.25, 192*0.25, 192*0.25]);
    mo.note = true;
    let dialogArr = [];
    for (let i = 0; i < noteLines.length; i++) {
        let id = noteLines[i][0];
        let type;
        switch (id) {
            case "P":
                type = 0;
                break;
            case "N":
                type = 2;
                break;
            case "T":
                type = 1;
                break;
            case "M":
                type = 3;
                break;
            case "C":
                type = 4;
                break;
            default:
                type = 2;
                break;
        }
        let line = noteLines[i].substring(1);
        if (type === 2) {
            line = "“" + line + "”";
        }
        dialogArr.push(new Dialog(line, type));
    }
    dialogArr[dialogArr.length-1].closeFunct = function() {
        doneFunct();
    }
    let note = {
        mo: mo,
        read: false,
        remove: function() {
            note.trigger.enabled = false;
            mo.hidden = true;
        }
    }
    noteArr.push(note);
    note.trigger = new Trigger([new HitCircle(pos, 200)], function() {
        for (let i = 0; i < dialogArr.length; i++) {
            dialogArr[i].addToQueue();
        }
        mo.gArr[0].frameIndex = 1;
        mo.gArr[0].fps = 0;
        note.read = true;
        Sound.sounds.paper.play();
    }, false, true, label+", press {i}E{/i} to read")
    return note;
}

export let testCanvas = null;

function loadStageTest() {
    // new MapObject([200, 200], [], [new HitBox([0,0], [1000, 1000], true)]);

    // forest.spawnForest([-100000, -100000], [100000, 100000], 0.5)
    
    for (let i = 0; i < 100000; i++) {
        //new MapObject([(Math.random()-0.5)*1000000, (Math.random()-0.5)*1000000], [], [new HitCircle([0,0], 50+Math.random()*100, true)])
        forest.spawnTree([(Math.random()-0.5)*100000, (Math.random()-0.5)*100000]);
    }

    let shrineGate1 = new MapObject([0, 100], [
        new Graphic("shrine/shrine_gate", ["wall"], ".png", 1.5, 1, 1, [-864/2*1.5,0,24*1.5], 1, null, false)
    ], [
        //new HitBox([200*1.5,0],[80*1.5,80*1.5],true),
        //new HitBox([584*1.5,0],[80*1.5,80*1.5],true),
        new HitCircle([200*1.5+40*1.5-864/2*1.5,40*1.5], 40*1.5,true),
        new HitCircle([584*1.5+40*1.5-864/2*1.5,40*1.5], 40*1.5,true)
    ], [
        -864*1.5/2, 0,
        864*1.5/2, 720*1.5
    ])

    /*
    for (let i = -10; i <= 10; i++) {
        for (let j = -10; j <= 10; j++) {
            new MapObject([i*1000, j*1000], [], [new HitCircle([0,0], 100+Math.random()*150, true)]);
        }
    }*/

    let pa = [Player.pos[0], Player.pos[1]];
    let pb = [inp.mouseCoords[0], inp.mouseCoords[1]]
    stageCalc = function() {
        pa = [Player.pos[0], Player.pos[1]];
        if (inp.inputs.leftClick.pressed) {
            pb = [Player.camPos[0]+inp.mouseCoords[0]/zoom, Player.camPos[1]-inp.mouseCoords[1]/zoom]
        }
    }

    stageBullets = function(cycles) {
        if (cycles % 1 === 0) {
            spawnRing(new MBullet(false, {
                type: MBullet.types.orb,
                pos: [Math.random()*1000-500,Math.random()*1000-500],
                dir: Math.random()*360,
                speed: 10,
                damage: 1,
                color: [255,0,0]
            }, [
                mod.moveTimer(120)
            ]), 5)
        }
    }

    stageDraw = function() {
        /*
        Draw.camCanvasOffset();
        c.lineWidth = 3;
        let intersect = MapObject.segCollision(pa, pb, [Player.hc.id]);

        c.strokeStyle = (intersect)? "rgb(255,0,0)" : "rgb(0,0,255)";
        c.beginPath();
        c.moveTo(pa[0], -pa[1])
        c.lineTo(pb[0], -pb[1])
        c.stroke();
        */
    }
}

function loadStageShrine() {
    // tutorial
    Dialog.call("Use {i}E{/i} to advance dialog text and interact with objects", 1)
    Dialog.call("Use {i}WASD{/i} to move around", 1)
    Dialog.call("Hold {i}Space{/i} while moving to sprint", 1)

    // start music
    Music.changeMusic("s1a");
    Player.pos = [0, -3000];
    Player.camPosTarget = [0, -3000];

    // shrine path
    for (let i = -20; i < 15; i++) {
        new MapObject([0,i*512*0.8], [
            new Graphic("shrine_path", ["floor"], ".png", 0.8, 1, 0, [-260*0.8,0])
        ], [], [-260*0.8, 0, 260*0.8, 512*0.8])
    }

    // shrine gate
    let shrineGate1 = new MapObject([0, 100], [
        new Graphic("shrine/shrine_gate", ["wall"], ".png", 1.5, 1, 1, [-864/2*1.5,0,24*1.5], 1, null, false)
    ], [
        //new HitBox([200*1.5,0],[80*1.5,80*1.5],true),
        //new HitBox([584*1.5,0],[80*1.5,80*1.5],true),
        new HitCircle([200*1.5+40*1.5-864/2*1.5,40*1.5], 40*1.5,true),
        new HitCircle([584*1.5+40*1.5-864/2*1.5,40*1.5], 40*1.5,true)
    ], [
        -864*1.5/2, 0,
        864*1.5/2, 720*1.5
    ])
    let shrineGate2 = new MapObject([0, 100], [
        new Graphic("shrine/stone_shrine_gate", ["wall"], ".png", 1.5, 1, 1, [-864/2*1.5,0,24*1.5], 1, null, false)
    ], [
        //new HitBox([200*1.5,0],[80*1.5,80*1.5],true),
        //new HitBox([584*1.5,0],[80*1.5,80*1.5],true),
        new HitCircle([200*1.5+40*1.5-864/2*1.5,40*1.5], 40*1.5,true),
        new HitCircle([584*1.5+40*1.5-864/2*1.5,40*1.5], 40*1.5,true)
    ], [
        -864*1.5/2, 0,
        864*1.5/2, 720*1.5
    ])

    // shrine
    let tiles = {
        f: new Tile(
            [
                new Graphic("shrine/new_walls/front", ["wall"], ".png", 1, 1, 0, [-32, -32, 32])
            ],
            [
                new HitBox([-16, -16], [544, 32], true, true),
                new HitCircle([0, 0], 32, true, true),
                new HitCircle([512, 0], 32, true, true)
            ],
            [
                -32,
                -32,
                544,
                544
            ]
        ),
        s: new Tile(
            [
                new Graphic("shrine/new_walls/side", ["wall"], ".png", 1, 1, 0, [-32, -32+64*8, 32])
            ],
            [
                new HitBox([-16, -16], [32, 544], true, true),
                new HitCircle([0, 0], 32, true, true),
                new HitCircle([0, 512], 32, true, true)
            ],
            [
                -32,
                -32,
                32,
                544+512
            ]
        ),
        x: new Tile( // side window
            [
                new Graphic("shrine/new_walls/side", ["wall"], ".png", 1, 1, 0, [-32, -32+64*8, 32])
            ],
            [
                new HitBox([-16, -16], [32, 544], false, true),
                new HitCircle([0, 0], 32, true, true),
                new HitCircle([0, 512], 32, true, true)
            ],
            [
                -32,
                -32,
                32,
                544+512
            ]
        ),
        c: new Tile(
            [
                new Graphic("shrine/new_walls/side", ["wall"], ".png", 1, 1, 0, [-32, -32, 32])
            ],
            [
                new HitBox([-16, -16-64*8], [32, 544], true, true),
                new HitCircle([0, -512], 32, true, true),
                new HitCircle([0, 0], 32, true, true)
            ],
            [
                -32,
                -32-512,
                32,
                544
            ]
        ),
        d: new Tile(
            [
                new Graphic("shrine/new_walls/side", ["wall"], ".png", 1, 1, 0, [-32, -32, 32]),
                new Graphic("shrine/new_walls/side", ["wall"], ".png", 1, 1, 0, [-32, -32+64*8, 32])
            ],
            [
                new HitBox([-16, -16-64*8], [32, 544], true, true),
                new HitBox([-16, -16], [32, 544], true, true),
                new HitCircle([0, -512], 32, true, true),
                new HitCircle([0, 0], 32, true, true),
                new HitCircle([0, 512], 32, true, true)
            ],
            [
                -32,
                -32-512,
                32,
                544+512
            ]
        ),
        p: new Tile(
            [
                new Graphic("shrine/new_walls/pillar", ["wall"], ".png", 1, 1, 0, [-32, -32+64*8, 32])
            ],
            [new HitCircle([0, 512], 32, true, true),],
            [
                -32,
                -32+512,
                32,
                544+512
            ]
        ),
        w: new Tile(
            [
                new Graphic("shrine/new_walls/window", ["wall"], ".png", 1, 1, 0, [-32, -32, 32])
            ],
            [
                new HitBox([-16, -16], [544, 32], false, true),
                new HitCircle([0, 0], 32, true, true),
                new HitCircle([512, 0], 32, true, true)
            ],
            [
                -32,
                -32,
                544,
                544
            ]
        ),
        g: new Tile(
            [
                new Graphic("shrine/new_walls/grid", ["wall"], ".png", 1, 1, 0, [-32, -32, 32])
            ],
            [
                new HitBox([-16, -16], [544, 32], true, true),
                new HitCircle([0, 0], 32, true, true),
                new HitCircle([512, 0], 32, true, true)
            ],
            [
                -32,
                -32,
                544,
                544
            ]
        ),
        F: new Tile(
            [
                new Graphic("shrine/old_walls/front", ["wall"], ".png", 1, 1, 0, [-32, -32, 32])
            ],
            [
                new HitBox([-16, -16], [544, 32], true, true),
                new HitCircle([0, 0], 32, true, true),
                new HitCircle([512, 0], 32, true, true)
            ],
            [
                -32,
                -32,
                544,
                544
            ]
        ),
        S: new Tile(
            [
                new Graphic("shrine/old_walls/side", ["wall"], ".png", 1, 1, 0, [-32, -32+64*8, 32])
            ],
            [
                new HitBox([-16, -16], [32, 544], true, true),
                new HitCircle([0, 0], 32, true, true),
                new HitCircle([0, 512], 32, true, true)
            ],
            [
                -32,
                -32,
                32,
                544+512
            ]
        ),
        X: new Tile(
            [
                new Graphic("shrine/old_walls/side", ["wall"], ".png", 1, 1, 0, [-32, -32+64*8, 32])
            ],
            [
                new HitBox([-16, -16], [32, 544], false, true),
                new HitCircle([0, 0], 32, true, true),
                new HitCircle([0, 512], 32, true, true)
            ],
            [
                -32,
                -32,
                32,
                544+512
            ]
        ),
        C: new Tile(
            [
                new Graphic("shrine/old_walls/side", ["wall"], ".png", 1, 1, 0, [-32, -32, 32])
            ],
            [
                new HitBox([-16, -16-64*8], [32, 544], true, true),
                new HitCircle([0, -512], 32, true, true),
                new HitCircle([0, 0], 32, true, true)
            ],
            [
                -32,
                -32-512,
                32,
                544
            ]
        ),
        D: new Tile(
            [
                new Graphic("shrine/old_walls/side", ["wall"], ".png", 1, 1, 0, [-32, -32, 32]),
                new Graphic("shrine/old_walls/side", ["wall"], ".png", 1, 1, 0, [-32, -32+64*8, 32])
            ],
            [
                new HitBox([-16, -16-64*8], [32, 544], true, true),
                new HitBox([-16, -16], [32, 544], true, true),
                new HitCircle([0, -512], 32, true, true),
                new HitCircle([0, 0], 32, true, true),
                new HitCircle([0, 512], 32, true, true)
            ],
            [
                -32,
                -32-512,
                32,
                544+512
            ]
        ),
        P: new Tile(
            [
                new Graphic("shrine/old_walls/pillar", ["wall"], ".png", 1, 1, 0, [-32, -32+64*8, 32])
            ],
            [new HitCircle([0, 512], 32, true, true),],
            [
                -32,
                -32+512,
                32,
                544+512
            ]
        ),
        W: new Tile(
            [
                new Graphic("shrine/old_walls/window", ["wall"], ".png", 1, 1, 0, [-32, -32, 32])
            ],
            [
                new HitBox([-16, -16], [544, 32], false, true),
                new HitCircle([0, 0], 32, true, true),
                new HitCircle([512, 0], 32, true, true)
            ],
            [
                -32,
                -32,
                544,
                544
            ]
        ),
        G: new Tile(
            [
                new Graphic("shrine/old_walls/grid", ["wall"], ".png", 1, 1, 0, [-32, -32, 32])
            ],
            [
                new HitBox([-16, -16], [544, 32], true, true),
                new HitCircle([0, 0], 32, true, true),
                new HitCircle([512, 0], 32, true, true)
            ],
            [
                -32,
                -32,
                544,
                544
            ]
        ),
        a: new Tile(
            [
                new Graphic("shrine/floors/wood", ["floor"], ".png")
            ],
            [],
            [
                0,
                0,
                512,
                512
            ]
        ),
        b: new Tile(
            [
                new Graphic("shrine/floors/stone", ["floor"], ".png")
            ],
            [],
            [
                0,
                0,
                512,
                512
            ]
        ),
    }

    let floorMap1 = [
        "                     ",
        "        aaaa         ",
        "        aaaa         ",
        "        aaaa         ",
        "        aaaa         ",
        "         aa          ",
        "         aa          ",
        "         aa          ",
        "         aa          ",
        "aaaaaaaaaaaaaaaaaaaa ",
        "aaaaaaaaaaaaaaaaaaaa ",
        "aaaaaaaaaaaaaaaaaaaa ",
        "aaaaaaaaaaaaaaaaaaaa ",
        "aaaaaaaaaaaaaaaaaaaa ",
        "aaaaaaaaaaaaaaaaaaaa ",
        "aaaaaaaaaaaaaaaaaaaa ",
        "aaaaaaaaaaaaaaaaaaaa ",
        "aaaaaaaaaaaaaaaaaaaa ",
        "aaaaaaaaaaaaaaaaaaaa ",
        "                     ",
    ]
    let wallMap1 = [
        "        wffw         ",
        "        s   s        ",
        "        x   x        ",
        "        d   s        ",
        "        w  ws        ",
        "         s s         ",
        "         x x         ",
        "         s d         ",
        "ffwffwfffs fffwffwff ",
        "s                   s",
        "x  ffgggfm fgggff   x",
        "s  s             s  s",
        "sm s             sm s",
        "x  p   p     p   p  x",
        "s                   s",
        "s  d   p     p   s  s",
        "xn ffgggffffgggffsn x",
        "d                   s",
        "ffwffwffwoowffwffwffs",
        "                    ",
    ]
    let floorMap2 = [];
    let wallMap2 = [];
    for (let r = 0; r < wallMap1.length; r++) {
        wallMap2.push(wallMap1[r].toUpperCase());
        floorMap2.push(floorMap1[r].replaceAll("a","b"));
    }
    let shrineOffset = [-64*8*(floorMap1[0].length-1)/2,5000]
    let stm1 = buildTileMap(shrineOffset, [64*8, 64*8], tiles, [floorMap1, wallMap1])
    let stm2 = buildTileMap(shrineOffset, [64*8, 64*8], tiles, [floorMap2, wallMap2])
    let shrine1 = stm1.moArr;
    let shrine2 = stm2.moArr;
    tiles = {
        m: new Tile([
            new Graphic("barrier/orange", ["wall"], ".png", 2, 1, 1, [-64*8,1], 0.5),
            new Graphic("barrier/orange", ["wall"], ".png", 2, 1, 1, [0, 0,1], 0.5),
            new Graphic("barrier/orange", ["wall"], ".png", 2, 1, 1, [64*8,1], 0.5)
        ], [new HitBox([-64*8,0], [64*8*3, 4*8], false, true)], [
            -64*8,
            0,
            128*8,
            64*8
        ])
    }
    for (let i = 0; i < 3; i++) {
        tiles.m.gArr[i].alpha = 0.5;
    }
    let obtm = buildTileMap(shrineOffset, [64*8, 64*8], tiles, [floorMap1, wallMap1]);
    let oBarrier = obtm.moArr;
    tiles = {
        n: new Tile([
            new Graphic("barrier/turquoise", ["wall"], ".png", 2, 1, 1, [-64*8,0,1], 0.5),
            new Graphic("barrier/turquoise", ["wall"], ".png", 2, 1, 1, [0,0,1], 0.5),
            new Graphic("barrier/turquoise", ["wall"], ".png", 2, 1, 1, [64*8,0,1], 0.5)
        ], [new HitBox([-64*8,0], [64*8*3, 4*8], false, true)], [
            -64*8,
            0,
            128*8,
            64*8
        ])
    }
    for (let i = 0; i < 3; i++) {
        tiles.n.gArr[i].alpha = 0.5;
    }
    let tbtm = buildTileMap(shrineOffset, [64*8, 64*8], tiles, [floorMap1, wallMap1]);
    let tBarrier = tbtm.moArr;
    tiles = {
        o: new Tile([new Graphic("barrier/purple", ["wall"], ".png", 2, 1, 1, [0, 0, 1], 0.5)], [new HitBox([0,0], [64*8, 4*8], false, true)], [
            -64*8,
            0,
            128*8,
            64*8
        ])
    }
    let pbtm = buildTileMap(shrineOffset, [64*8, 64*8], tiles, [floorMap1, wallMap1]);
    let pBarrier = pbtm.moArr;

    // add barrier graphics to list
    let barrierMoArr = [];
    for (let i = 0; i < obtm.moArr.length; i++) {
        barrierMoArr.push(obtm.moArr[i]);
    }
    for (let i = 0; i < tbtm.moArr.length; i++) {
        barrierMoArr.push(tbtm.moArr[i]);
    }
    for (let i = 0; i < pbtm.moArr.length; i++) {
        barrierMoArr.push(pbtm.moArr[i]);
    }

    // initialize preTransArr and postTransArr (designates mapobjects for shrine switching)
    let preTransArr = [shrineGate2];
    let postTransArr = [shrineGate1];

    // tables
    let spawnTable = function(pos) {
        let newTable = new MapObject([pos[0], pos[1]], [
            new Graphic("table/newMats", ["floor"], ".png", 1, 1, 1, [-71*8, -39*8], undefined, undefined),
            new Graphic("table/newTable", ["wall"], ".png", 1, 1, 1, [-71*8, -39*8, 70*8], undefined, undefined, false)
        ], [new HitBox([(-71+9)*8, -31*8], [126*8, 62*8])], [-71*8, -39*8, 71*8, 40*8]);
        let oldTable = new MapObject([pos[0], pos[1]], [
            new Graphic("table/oldMats", ["floor"], ".png", 1, 1, 1, [-71*8, -39*8], undefined, undefined),
            new Graphic("table/oldTable", ["wall"], ".png", 1, 1, 1, [-71*8, -39*8, 70*8], undefined, undefined, false),
        ], [new HitBox([(-71+9)*8, -31*8], [126*8, 62*8])], [-71*8, -39*8, 71*8, 40*8]);
        preTransArr.push(oldTable);
        postTransArr.push(newTable);
        return {newTable: newTable, oldTable: oldTable};
    }

    spawnTable([0, shrineOffset[1]+8*64*6]);
    spawnTable([0, shrineOffset[1]+8*64*7.5]);
    spawnTable([0, shrineOffset[1]+8*64*4.5]);

    // notes
    let forSaleNote = spawnNote([3000,5300], "For Sale Paper", [
        "NFor Sale",
        "PThis paper appears to be quite old."
    ]);

    // spawn yyorb
    PlayerProj.projArr.push(new PlayerProj([0,-14000], [0,0]));
    new Trigger([new HitCircle([0,14000], 500)], function() {
        Dialog.call("The disturbance is an orb? I bet the lab will enjoy analyzing this.")
    }, true, false)

    // FORESTS
    // spawn trees
    for (let i = 0; i < 10; i++) {
        forest.spawnTree([-500,500+i*500])
        forest.spawnTree([500,500+i*500])
    }

    // path side forests
    forest.spawnForest([-2000,-6000], [-6000, 4500]);
    forest.spawnForest([2000,-6000], [6000, 4500]);
    forest.spawnForest([-1500,-6000], [-2000, 4500], 0.2);
    forest.spawnForest([1500,-6000], [2000, 4500], 0.2);

    // bottom forest
    forest.spawnForest([-2000, -2000], [2000, -8000]);
    forest.spawnForest([-2000, -1500], [2000, -2000], 0.2);

    // side forests
    forest.spawnForest([-6000,1000], [-10000,16000]);
    forest.spawnForest([6000,1000], [10000,16000]);
    forest.spawnForest([-5500,1000], [-6000,16000], 0.2);
    forest.spawnForest([5500,1000], [6000,16000], 0.2);

    forest.spawnForest([-1500,11500], [-5500,15500], 0.2);
    forest.spawnForest([1500,11500], [5500,15500], 0.2);

    forest.spawnForest([-2000,4500], [-5500,5000], 0.2);
    forest.spawnForest([2000,4500], [5500,5000], 0.2);
    
    // top forest
    forest.spawnForest([-5500, 15500], [5500, 16000], 0.2);
    forest.spawnForest([-10000, 16000], [10000, 20000]);

    // mark trees that will disappear and reappear for path out of shrine
    let markedTrees = [];
    const bounds = [-500, -10000, 500, 0];
    for (let i = 0; i < forest.treeArr.length; i++) {
        let pos = forest.treeArr[i].pos;
        let mark = true;
        for (let j = 0; j < 2; j++) {
            if (pos[j] < bounds[j] || pos[j] > bounds[j+2]) {
                mark = false;
                break;
            }
        }
        if (mark) {
            markedTrees.push(forest.treeArr[i]);
            forest.treeArr[i].hidden = true;
        }
    }

    // hit box to prevent going back
    let returnBlocker = new MapObject([0,0], [], [new HitBox([-1000, -5000], [2000, 500], false)]);

    // trigger for hiding forest path
    let hidePathTrigger = new Trigger([new HitBox([-10000, 5000], [20000, 500])], function() {
        returnBlocker.remove();
        for (let i = 0; i < markedTrees.length; i++) {
            markedTrees[i].hidden = false;
        };
        Dialog.call("There seems to be a large quantity of energy inside this shrine. The disturbance must be located there.");
    }, true, false);

    // barrier message trigger
    let barrierMsgTrigger = new Trigger([
        new HitBox([-5100, 8600], [1500, 400]),
        new HitBox([3600, 8600], [1500, 400]),
        new HitBox([-500, 9600], [1000, 400])
    ], function() {
        Dialog.call("This barrier seems to be gathering energy from nearby spirits. Expelling all reachable spirits should allow me to pass through.");
    }, false, true, "Press {i}E{/i} to examine barrier")
    barrierMsgTrigger.enabled = false;

    // shrine switching
    const transitionTime = 600
    let transitionCycles = -1;
    for (let i = 0; i < shrine2.length; i++) {
        preTransArr.push(shrine2[i]);
    }
    for (let i = 0; i < shrine1.length; i++) {
        postTransArr.push(shrine1[i]);
    }
    for (let i = 0; i < oBarrier.length; i++) {
        postTransArr.push(oBarrier[i]);
    }
    for (let i = 0; i < tBarrier.length; i++) {
        postTransArr.push(tBarrier[i]);
    }
    for (let i = 0; i < pBarrier.length; i++) {
        postTransArr.push(pBarrier[i]);
    }
    for (let i = 0; i < postTransArr.length; i++) {
        let mo = postTransArr[i];
        mo.hidden = true;
    }

    // keeps track of enemies so barriers can disappear when necessary
    let eTopArr = [];
    let eMidArr = [];
    let eLowArr = [];

    let topDone = false;
    let midDone = false;
    let lowDone = false;

    stageCalc = function(cycles) {
        // stage calculations
        if (transitionCycles >= transitionTime) {
            if (transitionCycles === transitionTime) {
                Player.disableControl = false;
                Music.changeMusic("s1b");
                transitionCycles = transitionTime+1;
                for (let i = 0; i < preTransArr.length; i++) {
                    let mo = preTransArr[i];
                    mo.alpha = 1;
                    mo.hidden = true;
                }
                for (let i = 0; i < postTransArr.length; i++) {
                    let mo = postTransArr[i];
                    mo.alpha = 1;
                }
                // dialog
                Dialog.call("{s}Woah!{/s}")
                Dialog.call("These relics always seem to come with a trap, don't they?");
                Dialog.call("Interesting that this shrine is no longer the ruin it was before.");
                Dialog.call("It also seems that some objects have appeared.");

                // save and recall statues
                let ss1 = new SaveStatue([0,13000]);
                let rs1 = new RecallStatue([-500, 10500]);
                let rs2 = new RecallStatue([500, 10500]);
                let rs3a = new RecallStatue([-800,8072]);
                let rs3b = new RecallStatue([800,8072]);
                let ss2 = new SaveStatue([3800, 7300]);
                let ss3 = new SaveStatue([-3800, 7300]);
                let ss4 = new SaveStatue([0, 6000]);
                let rs4 = new RecallStatue([0,6400]);

                // notes
                forSaleNote.remove();
                let note1 = spawnNote([300,12300], "Research Note 1", [
                    "NI had hoped my research expedition would become fruitful upon seeing this shrine. Seeing as I now have this orb, this place did not disappoint.",
                    "NThat appears to be all though, so I should be looking for a way back to my lab. Though, I anticipate I will not be the last to enter this shrine.",
                    "NThese notes might be of assistance to someone in the future",
                    "N- Dr. Mori",
                    "PHow convenient. These research types always seem to be in over their heads, but at least I'm not the first to discover this place.",
                    "PHmm...this note seems recently written--perhaps I can find him."
                ]);
                let note2 = spawnNote([0, 7700], "Research Note 2", [
                     "NInterestingly there was another orb in the very center of the shrine.",
                     "NAfter spending some time inspecting these orbs, it appears that they each hold a large amount of spiritual energy. This allows them to be roughly controlled and flung.",
                     "NAs for this shrine, it resembles a meeting place for a major spirit-guiding group prevalent decades ago. It is a shame how worn down this place was when I arrived.",
                     "N- Dr. Mori",
                    "PWhat a pleasant surprise. With the number of hostile spirits present, I assumed the notes would have stopped after the first."
                ]);
                barrierMsgTrigger.enabled = true;

                // spawn yyorb
                PlayerProj.projArr.push(new PlayerProj([0,-8400], [0,0]));
                

                // add triggers
                // warp to stage 2
                let warpTrigger = new Trigger([new HitBox([-10000,-5000], [20000, 500])], function() {
                    StageTrans.startTrans("2");
                }, true, false);

                // combat tutorial triggers
                let ctt1 = new Trigger([new HitBox([-1000, 11500], [2000, 500])], function() {
                    Dialog.call("Hold and release the left mouse button to aim and throw your orb at spirits.", 1)
                    Dialog.call("The longer you hold down the button, the faster and stronger the orb becomes.", 1)
                    Dialog.call("Make sure to pick up your orbs once you throw them.", 1);
                }, true, false)
                let ct1 = new Trigger([new HitBox([-1000, 10000], [2000, 500])], function() {
                    Dialog.call("Your orb can block negative energy from the spirits both while you control it and once it's thrown. Use this to defend yourself.", 1);
                    Dialog.call("If the energy level in the top left corner ever fully depletes, you will be sent back to the previous Save Statue.", 1)
                    Dialog.call("Your energy recovers over time, so retreat if you are tired.", 1)
                }, true, false)

                let madDashDialogue = new Trigger([new HitBox([-500,5000], [1000, 500])], function() {
                    Dialog.call("The courtyard has...far too many spirits for me to handle.", undefined, undefined, function() {
                        changeZoom(1/3);
                        Player.offsetTarget[1] = -800;
                    }, function() {
                        changeZoom(3);
                        Player.offsetTarget[1] = 0;
                    })
                    Dialog.call("Let's see, no spirit has entered or exited the courtyard it seems. Perhaps they are incapable of doing so.")
                    Dialog.call("In that case, as the spirits are quite slow, it may be possible to make a {i}mad dash towards the exit{/i} of this cursed shrine.");
                }, true, false)

                // rehide marked trees
                for (let i = 0; i < markedTrees.length; i++) {
                    markedTrees[i].hidden = true;
                };

                // SPAWN ENEMIES
                /*
                y >= 8500 is top shrine
                y >= 6500 is middle shrine
                y >= 5500 is bottom shrine
                */

                let eArr = [];

                // tutorial enemy
                Enemy.spawnEnemy([0, 11000], "neutral");

                // agony and neutral enemies
                let posArr = [[0, 8000], [-3000, 8000], [3000, 8000], [-4000, 10000], [4000, 10000], [-3000, 6000], [3000, 6000], [-1000, 6000], [1000, 6000]];
                for (let i = 0; i < posArr.length; i++) {
                    let pos = posArr[i];
                    for (let j = 0; j < 2; j++) {
                        eArr.push(Enemy.spawnEnemy(ce.move([pos[0], pos[1]], Math.random()*360, Math.random()*300), "neutral"));
                        eArr.push(Enemy.spawnEnemy(ce.move([pos[0], pos[1]], Math.random()*360, Math.random()*300), "agony"));
                    }
                }

                // regret and evil enemies
                posArr = [[-2400, 6000], [2400, 6000]];
                for (let i = 0; i < posArr.length; i++) {
                    let pos = posArr[i];
                    eArr.push(Enemy.spawnEnemy([pos[0], pos[1]], "evil"));
                }

                posArr = [[-1600, 6000], [1600, 6000]];
                for (let i = 0; i < posArr.length; i++) {
                    let pos = posArr[i];
                    eArr.push(Enemy.spawnEnemy([pos[0], pos[1]], "regret"));
                }

                // sorrow enemies
                posArr = [[-1500, 8000], [1500, 8000]];
                for (let i = 0; i < posArr.length; i++) {
                    let pos = posArr[i];
                    eArr.push(Enemy.spawnEnemy([pos[0], pos[1]], "sorrow"));
                }
                for (let i = 0; i < eArr.length; i++) {
                    let e = eArr[i];
                    if (e.pos[1] >= 8500) {
                        eTopArr.push(e.id);
                    } else if (e.pos[i] >= 6500) {
                        eMidArr.push(e.id);
                    } else {
                        eLowArr.push(e.id);
                    }
                }

                // path enemies
                for (let i = 0; i < 24; i++) {
                    Enemy.spawnEnemy([-1000, -1000+i*250], (i % 2 === 0)? "neutral" : "agony");
                    Enemy.spawnEnemy([1000, -1000+i*250], (i % 2 === 0)? "neutral" : "agony");
                    if (i % 3 === 0) {
                        Enemy.spawnEnemy([0, -1000+i*250], (i % 2 === 0)? "regret" : "sorrow");
                    }
                }

                // update BVH
                BVH.create();
                
                // save game
                Save.save();
            } else {
                // central orb pickup detect
                let secondOrb = true;
                for (let i = 0; i < PlayerProj.projArr.length; i++) {
                    if (!PlayerProj.projArr[i].firstPickup) {
                        secondOrb = false;
                        break;
                    }
                }
                // barrier calc
                topDone = true;
                let eCount = 0;
                for (let i = 0; i < eTopArr.length; i++) {
                    if (eTopArr[i] in Enemy.eDict) {
                        eCount++;
                        if (eCount >= 3) {
                            topDone = false;
                            break;
                        }
                    }
                }
                barrierMsgTrigger.enabled = !topDone;
                for (let i = 0; i < oBarrier.length; i++)
                    oBarrier[i].hidden = topDone;

                midDone = secondOrb;
                eCount = 0;
                for (let i = 0; i < eMidArr.length; i++) {
                    if (eMidArr[i] in Enemy.eDict) {
                        eCount++;
                        if (eCount >= 3) {
                            midDone = false;
                            break;
                        }
                    }
                }
                for (let i = 0; i < tBarrier.length; i++)
                    tBarrier[i].hidden = midDone;

                lowDone = true;
                eCount = 0;
                for (let i = 0; i < eLowArr.length; i++) {
                    if (eLowArr[i] in Enemy.eDict) {
                        eCount++;
                        if (eCount >= 3) {
                            lowDone = false;
                            break;
                        }
                    }
                }
                for (let i = 0; i < pBarrier.length; i++)
                    pBarrier[i].hidden = lowDone;
            }
        } else if (transitionCycles >= 0) {
            transitionCycles++;
            Player.shakeMulti = (1-Math.abs(transitionCycles-transitionTime/2)/(transitionTime/2))*50;
            for (let i = 0; i < preTransArr.length; i++) {
                let mo = preTransArr[i];
                mo.alpha = 2-transitionCycles/(transitionTime/2);
                if (mo.alpha < 0) mo.alpha = 0;
                if (mo.alpha > 1) mo.alpha = 1;
            }
            for (let i = 0; i < postTransArr.length; i++) {
                let mo = postTransArr[i];
                mo.alpha = transitionCycles/(transitionTime/2);
                if (mo.alpha < 0) mo.alpha = 0;
                if (mo.alpha > 1) mo.alpha = 1;
            }
        } else if (PlayerProj.reserveCount > 0) {
            // start transition to alternate shrine
            Music.changeMusic();
            Sound.sounds.rumble.play();
            Player.disableControl = true;
            transitionCycles = 0;
            for (let i = 0; i < postTransArr.length; i++) {
                let mo = postTransArr[i];
                mo.alpha = 0;
                mo.hidden = false;
            }
        }

        // barrier fade oscillation
        let bAlpha = 0.5 + Math.sin(MainLoop.cycles/30*Math.PI)*0.25;
        for (let i = 0; i < barrierMoArr.length; i++) {
            let mo = barrierMoArr[i];
            for (let j = 0; j < mo.gArr.length; j++) {
                mo.gArr[j].alpha = bAlpha;
            }
        }
    }

    stageBullets = function(cycles) {
        // spawn stage bullets
    }
}

function buildSpiritBridge(offset, length) {
    const scale = 0.5;
    let sbFloorArr = [];
    let spiritBridge = [];
    let dim = [384*8*scale, 384*8*scale]
    let x = -dim[1]/2
    let y = 0
    for (let i = 0; i < length; i++) {
        let floor = new Graphic("spirit_bridge/floor", ["floor"], ".png", scale, 1, 0, [x, y]);
        sbFloorArr.push(floor);
        let gArr = [
            new Graphic("spirit_bridge/arch/off", ["wall"], ".png", scale, 1, 0, [x, y], 1, null, false),
            new Graphic("spirit_bridge/bridge/off", ["floor"], ".png", scale, 1, 0, [x, y]),
            new Graphic("spirit_bridge/arch", ["wall"], ".png", scale, 4, 8, [x, y], 1, null, false),
            new Graphic("spirit_bridge/bridge", ["floor"], ".png", scale, 4, 8, [x, y]),
            floor
        ];
        gArr[0].hidden = true;
        gArr[1].hidden = true;
        spiritBridge.push(new MapObject([offset[0], offset[1]+dim[1]*i], gArr, [
            new HitBox([x,y], [24*8*scale, 32*8*scale], true),
            new HitBox([x+24*8*scale,y], [4*8*scale, 32*8*scale], false),
            new HitBox([x+dim[0]-24*8*scale,y], [24*8*scale, 32*8*scale], true),
            new HitBox([x+dim[0]-28*8*scale,y], [4*8*scale, 32*8*scale], false),
        ], [
            x,
            0,
            -x,
            dim[1]
        ]));
    }
    return {
        spiritBridge: spiritBridge,
        sbFloorArr: sbFloorArr,
        disable: function() {
            for (let i = 0; i < spiritBridge.length; i++) {
                for (let j = 0; j < spiritBridge[i].gArr.length; j++) {
                    let g = spiritBridge[i].gArr[j];
                    if (j < 2) {
                        g.hidden = false;
                    } else {
                        g.hidden = true;
                    }
                }
            }
        },
        enable: function() {
            for (let i = 0; i < spiritBridge.length; i++) {
                for (let j = 0; j < spiritBridge[i].gArr.length; j++) {
                    let g = spiritBridge[i].gArr[j];
                    if (j < 2) {
                        g.hidden = true;
                    } else {
                        g.hidden = false;
                    }
                }
            }
        }
    };
}

function loadStageCity() {
    // play music
    Music.changeMusic("s2b");

    // player starting position
    let startPos = [0, -7000]
    // startPos = [0, 51000]
    // startPos = [0, (11.5+26*6)*256-500]
    Player.pos = [startPos[0], startPos[1]];
    Player.camPosTarget = [startPos[0], startPos[1]];

    // spawns yyOrbs
    for (let i = 0; i < 2; i++) {
        let p = new PlayerProj(ce.move(ce.flipY(startPos), Math.random()*360, Math.random()*10+10), [0,0]);
        p.thrown = false;
        PlayerProj.projArr.push(p);
    }

    // wrong dir warning
    let wrongDir = new Trigger([new HitBox([-10000, -9500], [20000, 2000])], function() {

    }, false, true, "Wrong Direction, Travel Upwards")

    // shrine path
    for (let i = -10; i < 22; i++) {
        new MapObject([0,-8500+i*512*0.8], [
            new Graphic("shrine_path", ["floor"], ".png", 0.8, 1, 0, [-260*0.8,0])
        ], [], [-260*0.8, 0, 260*0.8, 512*0.8])
    }

    // shrine gates
    let shrineGates = []
    for (let i = 0; i < 7; i++) {
        shrineGates.push(new MapObject([0, -12000+i*1500], [
            new Graphic("shrine/stone_shrine_gate", ["wall"], ".png", 1.5, 1, 1, [-864/2*1.5,0,24*1.5], 1, null, false)
        ], [
            //new HitBox([200*1.5,0],[80*1.5,80*1.5],true),
            //new HitBox([584*1.5,0],[80*1.5,80*1.5],true),
            new HitCircle([200*1.5+40*1.5-864/2*1.5,40*1.5], 40*1.5,true),
            new HitCircle([584*1.5+40*1.5-864/2*1.5,40*1.5], 40*1.5,true)
        ], [
            -864*1.5/2, 0,
            864*1.5/2, 720*1.5
        ]))
    }

    // city wall creation function
    let gateArr = [];
    function buildWall(midPos, length, scale) {
        const wallDim = [1024*scale, 1024*scale];
        const wallArr = [];
        const hbArr = [];
        let gateGraphic;
        let gateHitBox;
        let gateTrigger;
        for (let x = -length; x <= length + 1; x++) {
            let wall;
            // pillar hit boxes
            hbArr.push(new HitBox([(x-0.5)*wallDim[0]-6*8*scale,-180*scale], [12*8*scale,46*8*scale], true));
            hbArr.push(new HitBox([(x-0.5)*wallDim[0]-7*8*scale,(-180+3*8)*scale], [14*8*scale,(46-6)*8*scale], true));

            if (x === length + 1) break;

            // wall hit boxes
            if (x === 0) {
                wall = new Graphic("city_wall/gate", ["wall"], ".png", scale, 8, 0, [(x-0.5)*wallDim[0],-180*scale,80*scale], 1, 7);
                // left hbs
                hbArr.push(new HitBox([(x-0.5)*wallDim[0],-132*scale], [43*8*scale,(46-12)*8*scale], true));
                hbArr.push(new HitBox([x*wallDim[0]-21*8*scale,-(132-4*8)*scale], [2*8*scale,(46-20)*8*scale], true));
                hbArr.push(new HitBox([x*wallDim[0]-19*8*scale,-(132-5*8)*scale], [6*8*scale,(46-22)*8*scale], true));
                hbArr.push(new HitBox([x*wallDim[0]-13*8*scale,-(132-4*8)*scale], [2*8*scale,(46-20)*8*scale], true));
                //right hbs
                hbArr.push(new HitBox([(x+0.5)*wallDim[0]-43*8*scale,-132*scale], [43*8*scale,(46-12)*8*scale], true));
                hbArr.push(new HitBox([x*wallDim[0]+19*8*scale,-(132-4*8)*scale], [2*8*scale,(46-20)*8*scale], true));
                hbArr.push(new HitBox([x*wallDim[0]+13*8*scale,-(132-5*8)*scale], [6*8*scale,(46-22)*8*scale], true));
                hbArr.push(new HitBox([x*wallDim[0]+11*8*scale,-(132-4*8)*scale], [2*8*scale,(46-20)*8*scale], true));
                // gate
                gateGraphic = wall;
                gateHitBox = new HitBox([x*wallDim[0]-11*8*scale, -(132-5*8)*scale], [22*8*scale,8*scale])
                hbArr.push(gateHitBox);
                gateTrigger = new Trigger([new HitBox([midPos[0]-11*8*scale, midPos[1]-(132-5*8)*scale-100], [22*8*scale,100])], function() {

                }, false, true, "Defeat all enemies and hold all orbs");
            } else {
                wall = new Graphic("city_wall/wall", ["wall"], ".png", scale, 1, 0, [(x-0.5)*wallDim[0],-180*scale,48*scale]);
                hbArr.push(new HitBox([(x-0.5)*wallDim[0],-132*scale], [wallDim[0],(46-12)*8*scale], true));
            }
            wallArr.push(wall);
        }
        gateArr.push({
            g: gateGraphic,
            hb: gateHitBox,
            openState: 0, // 0 = closed, 7 = open
            trigger: gateTrigger,
        });
        let aabb = [
            (-length-0.5)*wallDim[0],
            -180*scale,
            (length+0.5)*wallDim[0],
            -180*scale+wallDim[1]
        ];
        let wall = {
            wall: new MapObject(midPos, wallArr, hbArr, aabb),
            gateGraphic: gateGraphic,
            gateHitBox: gateHitBox
        }
        return wall;
    }

    // tile map tile dict
    let tiles = {};

    // add path and river tiles
    function makePathG(fileName) {
        return [new Graphic(`path/${fileName}`, ["floor"], ".png", 0.5, 1, 0, [-128, -128])]
    }
    function makeRiverG(fileName) {
        if (fileName === "full") {
            return [new Graphic(`river/full`, ["floor"], ".png", 0.5, 1, 0, [-128, -128])]
        }
        return [
            new Graphic(`river/full`, ["floor"], ".png", 0.5, 1, 0, [-128, -128]),
            new Graphic(`river/${fileName}`, ["floor"], ".png", 0.5, 1, 0, [-128, -128])
        ]
    }
    function makeRiverC() {
        let c = new HitBox([-128,-128], [256,256], false, true)
        c.river = true;
        return c;
    }
    let tileAabb = [
        -128, -128, 128, 128
    ]
    const baseSides = ["l","b","r","t"];
    const baseCorners = ["tl","bl","br","tr"];

    // no edges/border
    tiles["pf--"] = new Tile(makePathG("full"), [], tileAabb);
    tiles["rf--"] = new Tile(makeRiverG("full"), [makeRiverC()], tileAabb);

    for (let i = 0; i < 4; i++) {
        let sides = [];
        let corners = [];
        for (let j = 0; j < 2; j++) {
            sides.push(baseSides[(i+j)%4]);
            corners.push(baseCorners[(i+j)%4]);
        }
        // single path edge
        tiles[`pe${sides[0]}-`] = new Tile(makePathG(`edge_${sides[0]}`), [], tileAabb);
        // adjacent path edges
        tiles[`pe${sides[0]}${sides[1]}`] = new Tile(makePathG(`edge_${sides[0]}${sides[1]}`), [], tileAabb);
        // single corner path edge
        tiles[`pc${corners[0]}`] = new Tile(makePathG(`corner_${corners[0]}`), [], tileAabb);
        // single river border
        tiles[`rb${sides[0]}-`] = new Tile(makeRiverG(`side_${sides[0]}`), [
            makeRiverC()
        ], tileAabb);
        // adjacent river borders
        tiles[`rb${sides[0]}${sides[1]}`] = new Tile(makeRiverG(`side_${sides[0]}${sides[1]}`), [
            makeRiverC()
        ], tileAabb);
        // single corner river border
        tiles[`rc${corners[0]}`] = new Tile(makeRiverG(`corner_${corners[0]}`), [
            makeRiverC()
        ], tileAabb);
    }

    // add alternate sideways river tiles for bridges (alternate river hitbox)
    const altWidth = 256-32*8*0.6
    tiles.rabl = new Tile(makeRiverG("side_b"), [
        new HitBox([-128,-128],[altWidth,256], false, true)
    ], tileAabb)
    tiles.rabl.colArr[0].river = true;
    tiles.rabr = new Tile(makeRiverG("side_b"), [
        new HitBox([128-altWidth,-128],[altWidth,256], false, true)
    ], tileAabb)
    tiles.rabr.colArr[0].river = true;
    tiles.ratl = new Tile(makeRiverG("side_t"), [
        new HitBox([-128,-128],[altWidth,256], false, true)
    ], tileAabb)
    tiles.ratl.colArr[0].river = true;
    tiles.ratr = new Tile(makeRiverG("side_t"), [
        new HitBox([128-altWidth,-128],[altWidth,256], false, true)
    ], tileAabb)
    tiles.ratr.colArr[0].river = true;

    // add inner walls
    /*
    tiles["iwf-"] = new Tile([
        new Graphic("inner_wall/front", ["wall"], ".png", 0.5, 1, 0, [0,0], 1, 0)
    ], [
        new HitBox([0,8], [256,24], true, true)
    ])
    tiles["iws-"] = new Tile([
        new Graphic("inner_wall/side", ["wall"], ".png", 0.5, 1, 0, [0,0,-256], 1, 0)
    ], [
        new HitBox([0,0], [40, 40], true, true),
        new HitBox([8,-256], [24, 256], true, true)
    ])
    tiles["iwe-"] = new Tile([
        new Graphic("inner_wall/end", ["wall"], ".png", 0.5, 1, 0, [0,0], 1, 0),
    ], [
        new HitBox([0,0], [40, 40], true, true),
    ])
    */
    tiles["iw--"] = new Tile([new Graphic("inner_wall", ["wall"], ".png", 0.5, 1, 0, [-128,-128])], [new HitBox([-128,-128], [256,256], true, true)], [-128, -128, 128, 384])

    // console.log(tiles)

    // tile map
    let xOffset = -256*7.5;
    let tileMap = []

    // NOTE: DIVIDERS ARE 6 ROWS LONG

    // END
    tileMap.push(
        "a---a---a---a---a---a---a---a---a---a---a---a---",
        "a---a---a---a---a---a---a---a---a---a---a---a---",
        "a---a---a---a---a---a---a---a---a---a---a---a---",
        "a---a---a---a---a---a---a---a---a---a---a---a---",
        "a---a---a---a---a---petlperta---a---a---a---a---",
        "a---a---a---a---a---pel-per-a---a---a---a---a---",
        "a---a---a---a---a---pel-per-a---a---a---a---a---",
    )
    
    for (let i in tileMap) {
        tileMap[i] = "iw--iw--" + tileMap[i] + "iw--iw--";
    }
    let ltmE = buildTileMap([xOffset,(18+26*7)*256], [256,256], tiles, [tileMap], 4)
    let levelMapE = ltmE.mo;
    tileMap = [];

    // divider
    for (let i = 0; i < 6; i++) {
        tileMap.push("a---a---a---a---a---pel-per-a---a---a---a---a---")
    }
    let wall8 = buildWall([0,(12+26*7)*256], 3, 2);

    // section 7
    tileMap.push(
        "a---a---a---a---a---pel-per-a---a---a---a---a---",
        "a---a---a---a---a---pel-per-a---a---a---a---a---",
        "a---a---a---a---a---pel-per-a---a---a---a---a---",
        "a---a---a---a---a---pel-per-a---a---a---a---a---",
        "a---a---a---a---a---pel-per-a---a---a---a---a---",
        "a---a---a---a---a---pel-per-a---a---a---a---a---",
        "rbt-rbt-rbt-rbrtiw--pel-per-a---a---a---a---a---",
        "rbb-rbb-rcblrbr-iw--pel-per-a---a---iw--iw--iw--",
        "a---a---rbl-rbr-iw--pel-per-a---a---a---a---a---",
        "a---a---rbl-rctrrbt-ratlratrrbt-rbt-rbt-rbt-rbt-",
        "a---a---rbl-rcbrrbb-rablrabrrbb-rbb-rbb-rbb-rbb-",
        "a---a---rbl-rbr-iw--pel-per-a---a---a---a---a---",
        "rbt-rbt-rctlrbr-iw--pel-per-a---a---iw--iw--iw--",
        "rbb-rbb-rbb-rbbriw--pel-per-a---a---a---a---a---",
        "a---a---a---a---a---pel-per-a---a---a---a---a---",
        "a---a---a---a---a---pel-per-a---a---a---a---a---",
        "a---a---a---a---a---pel-per-a---a---a---a---a---",
        "a---a---a---a---a---pel-per-a---a---a---a---a---",
        "a---a---a---a---a---pel-per-a---a---a---a---a---",
        "a---a---a---a---a---pel-per-a---a---a---a---a---",
    )

    for (let i in tileMap) {
        tileMap[i] = "iw--iw--" + tileMap[i] + "iw--iw--";
    }
    let ltm7 = buildTileMap([xOffset,(18+26*6)*256], [256,256], tiles, [tileMap], 4)
    let levelMap7 = ltm7.mo;
    tileMap = [];

    // divider
    for (let i = 0; i < 6; i++) {
        tileMap.push("a---a---a---a---a---pel-per-a---a---a---a---a---")
    }
    let wall7 = buildWall([0,(12+26*6)*256], 3, 2);

    // section 6
    tileMap.push(
        "a---a---a---a---a---pel-per-a---a---a---a---a---",
        "a---a---a---a---a---pel-per-a---a---a---a---a---",
        "a---a---a---a---a---pel-per-a---a---a---a---a---",
        "petlpet-pet-pet-pet-pctlper-a---a---a---a---a---",
        "pel-pcbrpeb-peb-peb-peb-pebra---iw--iw--iw--iw--",
        "pel-per-a---a---a---a---a---a---iw--iw--iw--iw--",
        "ratlratrrbt-rbt-rbt-rbt-rbt-rbt-rbt-rbrtiw--iw--",
        "rablrabrrbb-rbb-rbb-rbb-rbb-rbb-rcblrbr-iw--iw--",
        "pel-per-iw--a---a---a---a---a---rbl-rbr-a---a---",
        "pel-per-iw--a---a---a---a---a---rbl-rbr-a---a---",
        "pel-per-iw--a---a---a---a---a---rbl-rbr-a---a---",
        "pel-per-iw--a---a---a---a---a---rbl-rbr-a---a---",
        "ratlratrrbt-rbt-rbt-rbt-ratlratrrctlrbr-iw--iw--",
        "rablrabrrbb-rbb-rbb-rbb-rablrabrrbb-rbbriw--iw--",
        "pel-per-a---a---a---a---a---a---iw--iw--iw--iw--",
        "pel-pctrpet-pet-pet-pet-perta---iw--iw--iw--iw--",
        "pelbpeb-peb-peb-peb-pcblper-a---a---a---a---a---",
        "a---a---a---a---a---pel-per-a---a---a---a---a---",
        "a---a---a---a---a---pel-per-a---a---a---a---a---",
        "a---a---a---a---a---pel-per-a---a---a---a---a---",
    )

    for (let i in tileMap) {
        tileMap[i] = "iw--iw--" + tileMap[i] + "iw--iw--";
    }
    let ltm6 = buildTileMap([xOffset,(18+26*5)*256], [256,256], tiles, [tileMap], 4)
    let levelMap6 = ltm6.mo;
    tileMap = [];

    // divider
    for (let i = 0; i < 6; i++) {
        tileMap.push("a---a---a---a---a---pel-per-a---a---a---a---a---")
    }
    let wall6 = buildWall([0,(12+26*5)*256], 3, 2);

    // section 5
    tileMap.push(
        "a---a---a---a---a---pel-per-a---a---a---a---a---",
        "a---a---a---a---a---pel-per-a---a---a---a---a---",
        "a---a---a---a---a---pel-pctrpet-pet-perta---a---",
        "a---a---a---a---a---pelbpeb-peb-pcblper-a---a---",
        "a---a---a---a---a---a---a---a---pel-per-a---a---",
        "rbt-ratlratrrbt-rbt-rbt-rbt-rbt-ratlratrrbt-rbt-",
        "rbb-rablrabrrbb-rbb-rbb-rbb-rbb-rablrabrrbb-rbb-",
        "a---a---a---a---a---iw--a---a---pel-per-a---a---",
        "a---a---a---a---a---iw--a---a---pel-per-a---a---",
        "a---a---a---a---a---iw--a---a---pel-per-a---a---",
        "a---a---a---a---a---iw--a---a---pel-per-a---a---",
        "a---a---a---a---a---iw--a---a---pel-per-a---a---",
        "a---a---a---a---a---a---a---a---pel-per-a---a---",
        "a---a---a---a---a---a---a---a---pel-per-a---a---",
        "a---a---a---a---a---iw--a---a---pel-per-a---a---",
        "a---a---a---a---a---iw--a---a---pel-per-a---a---",
        "a---a---a---a---a---iw--a---a---pel-per-a---a---",
        "a---a---a---a---a---iw--a---a---pel-per-a---a---",
        "a---a---a---a---a---iw--a---a---pel-per-a---a---",
        "iw--iw--iw--iw--iw--iw--a---a---pel-per-a---a---",
    )

    for (let i in tileMap) {
        tileMap[i] = "iw--iw--" + tileMap[i] + "iw--iw--";
    }
    let ltm5 = buildTileMap([xOffset,(18+26*4)*256], [256,256], tiles, [tileMap], 4)
    let levelMap5 = ltm5.mo;
    tileMap = [];

    // divider
    for (let i = 0; i < 6; i++) {
        tileMap.push("a---a---a---a---a---a---a---a---pel-per-a---a---")
    }
    let wall5 = buildWall([3*256,(12+26*4)*256], 3, 2);

    // section 4
    tileMap.push(
        "a---a---a---a---a---a---a---a---pel-per-a---a---",
        "a---a---a---a---a---a---a---a---pel-per-a---a---",
        "a---a---a---a---a---petlpet-pet-pctlper-a---a---",
        "a---a---a---a---a---pel-pcbrpeb-peb-pebra---a---",
        "a---a---a---a---a---pel-per-a---a---a---a---a---",
        "iw--iw--iw--iw--iw--pel-per-iw--iw--iw--iw--iw--",
        "rbt-rbt-rbt-rbt-rbt-ratlratrrbt-rbt-rbt-rbt-rbt-",
        "rbb-rbb-rbb-rbb-rbb-rablrabrrbb-rbb-rbb-rbb-rbb-",
        "a---a---a---a---a---pel-per-a---a---a---a---a---",
        "a---a---a---a---a---pel-per-a---a---a---a---a---",
        "a---a---a---a---a---pel-per-a---a---a---a---a---",
        "a---a---a---a---a---pel-per-a---a---a---a---a---",
        "rbt-rbt-rbt-rbt-rbt-ratlratrrbt-rbt-rbt-rbt-rbt-",
        "rbb-rbb-rbb-rbb-rbb-rablrabrrbb-rbb-rbb-rbb-rbb-",
        "iw--iw--iw--iw--iw--pel-per-iw--iw--iw--iw--iw--",
        "a---a---a---a---a---pel-per-a---a---a---a---a---",
        "a---a---a---a---a---pel-per-a---a---a---a---a---",
        "a---a---a---a---a---pel-per-a---a---a---a---a---",
        "a---a---a---a---a---pel-per-a---a---a---a---a---",
        "a---a---a---a---a---pel-per-a---a---a---a---a---",
    )

    for (let i in tileMap) {
        tileMap[i] = "iw--iw--" + tileMap[i] + "iw--iw--";
    }
    let ltm4 = buildTileMap([xOffset,(18+26*3)*256], [256,256], tiles, [tileMap], 4)
    let levelMap4 = ltm4.mo;
    tileMap = [];

    // divider
    for (let i = 0; i < 6; i++) {
        tileMap.push("a---a---a---a---a---pel-per-a---a---a---a---a---")
    }
    let wall4 = buildWall([0,(12+26*3)*256], 3, 2);

    // section 3
    tileMap.push(
        "a---a---a---a---a---pel-per-a---a---a---a---a---",
        "rbt-rbt-rbt-rbrta---pel-per-a---a---a---a---a---",
        "rbb-rbb-rcblrbr-a---pel-per-a---a---a---a---a---",
        "a---a---rbl-rbr-a---pel-per-a---a---a---a---a---",
        "a---a---rbl-rbr-a---pel-per-a---iw--a---a---a---",
        "a---a---rbl-rbr-a---pel-per-a---iw--a---a---a---",
        "a---a---rbl-rbr-a---pel-per-a---iw--a---a---a---",
        "a---a---rbl-rbr-a---pel-per-a---a---a---a---a---",
        "a---a---rbl-rbr-a---pel-per-a---a---a---a---a---",
        "a---a---rbl-rbr-a---pel-per-a---a---a---a---a---",
        "a---a---rbl-rbr-a---pel-per-a---a---a---a---a---",
        "a---a---rbl-rbr-a---pel-per-a---a---a---a---a---",
        "a---a---rbl-rbr-a---pel-per-a---a---a---a---a---",
        "a---a---rbl-rbr-a---pel-per-a---iw--a---a---a---",
        "a---a---rbl-rbr-a---pel-per-a---iw--a---a---a---",
        "a---a---rbl-rbr-a---pel-per-a---iw--a---a---a---",
        "a---a---rbl-rbr-a---pel-per-a---a---a---a---a---",
        "rbt-rbt-rctlrbr-a---pel-per-a---a---a---a---a---",
        "rbb-rbb-rbb-rbbra---pel-per-a---a---a---a---a---",
        "a---a---a---a---a---pel-per-a---a---a---a---a---",
    )

    for (let i in tileMap) {
        tileMap[i] = "iw--iw--" + tileMap[i] + "iw--iw--";
    }
    let ltm3 = buildTileMap([xOffset,(18+26*2)*256], [256,256], tiles, [tileMap], 4)
    let levelMap3 = ltm3.mo;
    tileMap = [];

    // divider
    for (let i = 0; i < 6; i++) {
        tileMap.push("a---a---a---a---a---pel-per-a---a---a---a---a---")
    }
    let wall3 = buildWall([0,(12+26*2)*256], 3, 2);

    // section 2
    tileMap.push(
        "a---a---a---a---a---pel-per-a---a---a---a---a---",
        "a---a---a---a---a---pel-per-a---a---a---a---a---",
        "a---a---a---a---a---pel-per-a---a---a---a---a---",
        "a---a---a---a---a---pel-per-a---a---a---a---a---",
        "a---a---a---a---a---pel-per-a---a---a---a---a---",
        "ratlratrrbt-rbrta---pel-per-a---a---a---a---a---",
        "rablrabrrcblrbr-a---pel-per-a---a---a---a---a---",
        "a---a---rbl-rbr-a---pel-per-a---a---a---a---a---",
        "a---a---rbl-rbr-a---pel-per-a---a---a---a---a---",
        "a---a---rbl-rctrrbt-ratlratrrbt-rbt-rbt-rbt-rbt-",
        "a---a---rbl-rcbrrbb-rablrabrrbb-rbb-rbb-rbb-rbb-",
        "a---a---rbl-rbr-a---pel-per-a---a---a---a---a---",
        "a---a---rbl-rbr-a---pel-per-a---a---a---a---a---",
        "a---a---rbl-rbr-a---pel-per-a---a---a---a---a---",
        "a---a---rbl-rbr-a---pel-per-a---a---a---a---a---",
        "a---a---rbl-rbr-a---pel-per-a---a---a---a---a---",
        "a---a---rbl-rbr-a---pel-per-a---a---a---a---a---",
        "a---a---rbl-rbr-a---pel-per-a---a---a---a---a---",
        "a---a---rbl-rbr-a---pel-per-a---a---a---a---a---",
        "a---a---rbl-rbr-a---pel-per-a---a---a---a---a---",
    )

    for (let i in tileMap) {
        tileMap[i] = "iw--iw--" + tileMap[i] + "iw--iw--";
    }
    let ltm2 = buildTileMap([xOffset,(18+26*1)*256], [256,256], tiles, [tileMap], 4)
    let levelMap2 = ltm2.mo;
    tileMap = [];

    // divider
    for (let i = 0; i < 6; i++) {
        tileMap.push("a---a---rbl-rbr-a---pel-per-a---a---a---a---a---")
    }

    let wall2 = buildWall([0,(12+26*1)*256], 3, 2);

    // section 1
    tileMap.push(
        "a---a---rbl-rbr-a---pel-per-a---a---a---a---a---",
        "a---a---rbl-rbr-a---pel-per-a---a---a---a---a---",
        "a---a---rbl-rbr-a---pel-per-a---a---a---a---a---",
        "a---a---rbl-rbr-a---pel-per-a---a---a---a---a---",
        "a---a---rbl-rbr-a---pel-per-a---a---a---a---a---",
        "a---a---rbl-rbr-a---pel-per-a---a---a---a---a---",
        "rbt-rbt-rctlrctrrbt-ratlratrrbt-rbt-rbt-rbt-rbt-",
        "rbb-rbb-rbb-rbb-rbb-rablrabrrbb-rbb-rbb-rbb-rbb-",
        "a---a---a---a---a---pel-per-a---a---a---a---a---",
        "a---a---a---a---a---pel-per-a---a---a---a---a---",
        "a---a---a---a---a---pel-per-a---a---a---a---a---",
        "a---a---a---a---a---pel-per-a---a---a---a---a---",
        "a---a---a---a---a---pel-per-a---a---a---a---a---",
        "a---a---a---a---a---pel-per-a---a---a---a---a---",
        "a---a---a---a---a---pel-per-a---a---a---a---a---",
        "a---a---a---a---a---pel-per-a---a---a---a---a---",
        "a---a---a---a---a---pel-per-a---a---a---a---a---",
        "a---a---a---a---a---pel-per-a---a---a---a---a---",
        "a---a---a---a---a---pel-per-a---a---a---a---a---",
        "a---a---a---a---a---pel-per-a---a---a---a---a---",
    )

    for (let i in tileMap) {
        tileMap[i] = "iw--iw--" + tileMap[i] + "iw--iw--";
    }
    let ltm1 = buildTileMap([xOffset,18*256], [256,256], tiles, [tileMap], 4)
    let levelMap1 = ltm1.mo;
    tileMap = [];

    // divider
    for (let i = 0; i < 6; i++) {
        tileMap.push("a---a---a---a---a---pel-per-a---a---a---a---a---")
    }

    let wall1 = buildWall([0,12*256], 3, 2);

    // START
    tileMap.push(
        "a---a---a---a---a---pel-per-a---a---a---a---a---",
        "a---a---a---a---a---pel-per-a---a---a---a---a---",
        "a---a---a---a---a---pel-per-a---a---a---a---a---",
        "a---a---a---a---a---pelbpebra---a---a---a---a---",
        "a---a---a---a---a---a---a---a---a---a---a---a---",
        "a---a---a---a---a---a---a---a---a---a---a---a---",
        "a---a---a---a---a---a---a---a---a---a---a---a---",
        "a---a---a---a---a---a---a---a---a---a---a---a---",
        "rbt-rbt-ratlratrrbt-ratlratrrbt-ratlratrrbt-rbt-",
        "rbb-rbb-rablrabrrbb-rablrabrrbb-rablrabrrbb-rbb-",
        "a---a---a---a---a---a---a---a---a---a---a---a---",
        "a---a---a---a---a---a---a---a---a---a---a---a---",
    )

    for (let i in tileMap) {
        tileMap[i] = "iw--iw--" + tileMap[i] + "iw--iw--";
    }
    let ltm0 = buildTileMap([xOffset,0], [256,256], tiles, [tileMap], 4)
    let levelMap0 = ltm0.mo;
    tileMap = [];

    // level map (rivers, paths, and inner walls)
    /*
    let ltm = buildTileMap([0,0], [256,256], tiles, [tileMap], 4)
    let levelMap = ltm.mo;
    levelMap.pos = [ltm.pos[0]-ltm.dim[0]/2+128, ltm.pos[1]]
    */

    // bridges and buttons and recall/save statues
    let bridge0a = new Bridge([-3*256, 2.5*256], "0a", Bridge.colors.red)
    let button0a = new Button([-3*256, -0.5*256], "0a", Button.colors.red)
    let bridge0b = new Bridge([0, 2.5*256], "0b", Bridge.colors.green)
    let button0b = new Button([0, -0.5*256], "0b", Button.colors.green)
    let bridge0c = new Bridge([3*256, 2.5*256], "0c", Bridge.colors.blue)
    let button0c = new Button([3*256, -0.5*256], "0c", Button.colors.blue)
    let ss0a = new SaveStatue([-2*256,-3.5*256])
    let rs0a = new RecallStatue([0,-2.5*256])
    let rs0b = new RecallStatue([0,5.5*256])
    
    let bridge1a = new Bridge([0, 30.5*256], "1a", Bridge.colors.red)
    let button1a = new Button([-5*256,34.5*256], "1a", Button.colors.red)
    let rs1a = new RecallStatue([4*256,20.5*256])
    let rs1b = new RecallStatue([4*256,34.5*256])

    let bridge2a = new Bridge([0, 53.5*256], "2a", Bridge.colors.red)
    let button2a = new Button([4*256,50.5*256], "2a", Button.colors.red)
    let bridge2b = new Bridge([-5*256, 57.5*256], "2b", Bridge.colors.blue)
    let button2b = new Button([-3*256,61.5*256], "2b", Button.colors.blue)
    let rs2a = new RecallStatue([4*256,46.5*256])
    let rs2b = new RecallStatue([-5*256,53.5*256])

    let rs3a = new RecallStatue([5*256,79.5*256])

    let bridge4a = new Bridge([0, 102.5*256], "4a", Bridge.colors.green)
    let button4a1 = new Button([4*256,98.5*256], "4a", Button.colors.green)
    let button4a2 = new Button([-4*256,105.5*256], "4a", Button.colors.green)
    let bridge4b = new Bridge([0, 108.5*256], "4b", Bridge.colors.blue)
    let button4b1 = new Button([4*256,105.5*256], "4b", Button.colors.blue)
    let button4b2 = new Button([-4*256,112.5*256], "4b", Button.colors.blue)
    let ss4a = new SaveStatue([2*256,98.5*256])
    let rs4a = new RecallStatue([-2*256,98.5*256])

    let bridge5a1 = new Bridge([3*256, 135.5*256], "5a", Bridge.colors.red)
    let bridge5a2 = new Bridge([-4*256, 135.5*256], "5a", Bridge.colors.red)
    let button5a1 = new Button([-4*256,124.5*256], "5a", Button.colors.red)
    let button5a2 = new Button([-2*256,138.5*256], "5a", Button.colors.red)
    let rs5a = new RecallStatue([0.5*256,126.5*256])
    let rs5b = new RecallStatue([-4*256,138.5*256])

    let bridge6a = new Bridge([1*256, 154.5*256], "6a", Bridge.colors.blue)
    let button6a = new Button([-5*256, 149.5*256], "6a", Button.colors.blue)
    let bridge6b = new Bridge([-5*256, 154.5*256], "6b", Bridge.colors.green)
    let button6b = new Button([5*256, 157.5*256], "6b", Button.colors.green)
    let bridge6c = new Bridge([-5*256, 160.5*256], "6c", Bridge.colors.red)
    let button6c = new Button([0, 157.5*256], "6c", Button.colors.red)
    let rs6a = new RecallStatue([4*256,150.5*256])
    let rs6b = new RecallStatue([-5*256,165.5*256])
    let ss6a = new SaveStatue([0*256,165.5*256])

    let bridge7a = new Bridge([0, 183.5*256], "7a", Bridge.colors.blue)
    let button7a = new Button([-5*256, 183.5*256], "7a", Button.colors.blue)
    let rs7a = new RecallStatue([4*256,177.5*256])
    let rs7b = new RecallStatue([4*256,189.5*256])

    let rsE = new RecallStatue([0, 202.5*256])

    // room triggers
    let rt3 = new Trigger([new HitBox([-256,(11.5+26*2)*256], [512,256])], function() {
        // spawn room 3 enemies
        Enemy.spawnEnemy([-5*256,75*256], "evil");
        Enemy.spawnEnemy([-5*256,78*256], "sorrow");
        Enemy.spawnEnemy([-5*256,81*256], "sorrow");
        Enemy.spawnEnemy([-5*256,84*256], "evil");
        for (let i = 0; i < 3; i++) {
            Enemy.spawnEnemy(ce.move([5*256,75*256], Math.random()*360, Math.random()*100), "agony");
            Enemy.spawnEnemy(ce.move([5*256,84*256], Math.random()*360, Math.random()*100), "agony");
        }
        Dialog.call("Unfortunately, there appears to be spirits here as well.");
    }, true, false)

    let rt5 = new Trigger([new HitBox([256*2, (11.5+26*4)*256], [512,256])], function() {
        // spawn room 5 enemies
        Enemy.spawnEnemy([-4*256,124.5*256], "regret");
        Enemy.spawnEnemy([-4*256,128.5*256], "regret");
        Enemy.spawnEnemy([-2*256,124.5*256], "neutral");
        Enemy.spawnEnemy([-2*256,124.5*256], "neutral");
        Enemy.spawnEnemy([-4*256,132.5*256], "agony");
        Enemy.spawnEnemy([-2*256,132.5*256], "agony");

        Enemy.spawnEnemy([3*256,137*256], "evil");
        Enemy.spawnEnemy([5*256,137*256], "evil");
        Enemy.spawnEnemy([4*256,132*256], "regret");
    }, true, false)

    let rt7 = new Trigger([new HitBox([-256, (11.5+26*6)*256], [512,256])], function() {
        // spawn room 7 enemies
        Enemy.spawnEnemy([3*256,182*256], "rage");
        Enemy.spawnEnemy([3*256,187*256], "rage");

        Enemy.spawnEnemy(ce.move([4*256,179*256], Math.random()*360, Math.random()*100), "regret");
        Enemy.spawnEnemy(ce.move([4*256,188*256], Math.random()*360, Math.random()*100), "regret");
        for (let i = 0; i < 2; i++) {
            Enemy.spawnEnemy(ce.move([4*256,179*256], Math.random()*360, Math.random()*100), "neutral");
            Enemy.spawnEnemy(ce.move([4*256,179*256], Math.random()*360, Math.random()*100), "agony");

            Enemy.spawnEnemy(ce.move([4*256,188*256], Math.random()*360, Math.random()*100), "neutral");
            Enemy.spawnEnemy(ce.move([4*256,188*256], Math.random()*360, Math.random()*100), "agony");
        }

        Enemy.spawnEnemy([0, 179*256], "sorrow")
    }, true, false)

    // TRIGGERS
    // dialog and notes
    let shrineEscapeDialog = new Trigger([new HitBox([-10000, -5000], [20000, 500])], function() {
        Dialog.call("No spirits seem to be pursuing me, but that could easily change...")
    }, true, false)

    let note3 = spawnNote([-150, -1360], "Research Note 3", [
        "NI have finally reached the exit of that shrine, but my surroundings are completely distinct from what they were when I first arrived.",
        "NIs this a parallel dimension? An alternate reality? I do not know, but ahead of me is a {i}city{/i} of all things. Hopefully I can find some answers there.",
        "N- Dr. Mori",
        "PHe doesn't even mention the swarm of spirits! How in the world did this bumbling academic get past the courtyard? I need to locate him."
    ]);

    let eggNote = spawnNote([-1200, 11600], "Egg Petition", [
        "NEggs are very versatile! First, you can decorate them and make them look pretty, or use eggs to make delishes meals, or you can throw them around like a lunatic, being like \“Haha, get egged!\” That's just way too fun!",
        "NAlso, cooking with eggs! I really like when egg meals have that suspicious looking gleam, and it's amazing how it can look really tasty or just be a complete disaster. I really like how it can fulfill all those abstract needs.",
        "NBeing able to switch up the styles and colors of eggs based on your mood is a lot of fun too! It's actually so much fun! You have those scrambled eggs, or the thick hard-boiled eggs, everything! It's like you're enjoying all these kinds of eggs at a buffet.",
        "NI really want one of the great Generals to try using them or for Blackbeard to try using them to replace his grits. We really need eggs to become a thing in the spirit realm and start making them for the Yama. Don't. You. Think. We. Really. Need. To. Officially. Give. Everyone. Eggs?",
        "PSounds like a sales pitch for... eggs? Did Mori write this?"
    ]);
    eggNote.read = true;

    let note4 = spawnNote([-240, 40000], "Research Note 4", [
        "NThese brain teasers are a bit simple, but they provide a pleasant distraction.",
        "NNot too much of one though! I still had time to figure out what is at the end of the city.",
        "NThe water channels are dense with spiritual energy, so I suspect they come from the {i}Sanzu River{/i}.",
        "NIf this is true then there should be a bridge up ahead and maybe even a door back to the normal world.",
        "NPerhaps I can meet some spirits crossing into the afterlife there.",
        "N- Dr. Mori",
        "PThe Sanzu River? These spirits should be crossing it on their way into the afterlife instead of harassing me.",
        "PIf Dr. Mori's conjectures are true, then this disturbance might be more severe than some mere orbs."
    ]);

    let sanzuBridgeDialog = new Trigger([new HitBox([-10000, 51800], [20000, 200])], function() {
        Dialog.call("This must be the Sanzu River, I bet Mori was quite ecstatic.", undefined, undefined, function() {
            changeZoom(1/3);
            Player.offsetTarget = [0, 5000];
        });
        Dialog.call("The Bridge appears to be fine, but where are the spirits?", undefined, undefined, undefined, function() {
            changeZoom(3);
            Player.offsetTarget = [0, 0];
        });
    }, true, false)

    let btFirstRun = true;
    let bridgeTutorial = new Trigger([
        new HitCircle([-3*256, -0.5*256], 300),
        new HitCircle([0, -0.5*256], 300),
        new HitCircle([3*256, -0.5*256], 300)
    ], function() {
        if (btFirstRun) {
            btFirstRun = false;
            Dialog.call("I can see a path through the city, but these waterways are annoyingly obtrusive.")
        }
        Dialog.call("Throw an orb onto a button to activate its corresponding bridge. You can only exit a puzzle if you have both orbs.", 1);
        Dialog.call("If you lose any orbs, you can interact with a Recall Statue to retrieve your them.", 1);
    }, false, true, "Press {i}E{/i} to examine buttons")

    /*
    let dt1 = new Trigger([new HitBox([-10000, 7300], [10000, 200])], function() {
        Dialog.call("How do I make it across this bridge...");
    }, true, false)
    */

    let farSightNote = spawnNote([-1250, 7370], "Mysterious Note", [
        "NPress {i}X{/i} to toggle {i}far sight mode{/i}",
        "NThis will allow you to see farther away objects, but you cannot move while in this mode",
        "NYou can also aim and launch your orbs while in this mode",
        "PIs \"far sight mode\" some academic jargon?"
    ])

    // sanzu river
    let sanzuOffset = [0, 52000];
    let scale = 1;
    let gArr = [];
    for (let y = 0; y < 15; y++) {
        for (let x = -5; x <= 5; x++) {
            // add graphic
            gArr.push(new Graphic("sanzu/lower/"+((y === 0)? "shore" : "full"), ["floor"], ".png", scale, 2, 1, [-1024*scale+x*2048*scale, 1024*scale*y]));
        }
    }
    let hb1 = new HitBox([-5.5*2048*scale, 0.5*1024*scale], [5.5*2048*scale-96*8, 14.5*1024*scale]);
    let hb2 = new HitBox([96*8, 0.5*1024*scale], [5.5*2048*scale-96*8, 14.5*1024*scale]);
    hb1.river = true;
    hb2.rivier = true;
    let sanzu = new MapObject(sanzuOffset, gArr, [hb1, hb2], [-5.5*2048, 0, 5.5*2048, 15*1024]);

    // spirit bridge
    let sbData = buildSpiritBridge(sanzuOffset, 10);
    let spiritBridge = sbData.spiritBridge;
    let sbFloorArr = sbData.sbFloorArr;

    // forest
    forest.spawnForest([-500, -14000], [-5000, -4000]);
    forest.spawnForest([500, -14000], [5000, -4000]);

    forest.spawnForest([-500, -4000], [-7000, -1500]);
    forest.spawnForest([500, -4000], [7000, -1500]);

    forest.spawnForest([-2200, -1500], [-7000, 50000]);
    forest.spawnForest([2200, -1500], [7000, 50000]);

    // edge boundaries and block backwards travel
    let borders = new MapObject([0,0], [], [
        new HitBox([-8048, 0], [6000, 50000]),
        new HitBox([2048, 0], [6000, 50000]),
        new HitBox([-10000, -10000], [20000, 500], false, false)
    ]);

    // warp
    /*
    let warpTrigger = new Trigger([new HitCircle([0,-10000], 500)], function() {
        Stage.loadStage("shrine");
    }, false, true, "press {i}E{/i} to warp to stage 1")
    */

    let s3Warp = new Trigger([new HitBox([-3000, 64000], [6000, 500])], function() {
        StageTrans.startTrans("3");
    }, true, true);

    /*
    let wallMaria = buildWall(2000, 3, 2);
    let wallRose = buildWall(7000, 3, 2);
    let wallSheena = buildWall(12000, 3, 2);
    wallMaria.open();
    wallRose.open();
    wallSheena.open();
    */

    stageCalc = function(cycles) {
        // stage calculations
        for (let i = 0; i < sbFloorArr.length; i++) {
            sbFloorArr[i].alpha = 0.5+Math.sin(cycles*Math.PI/60)*0.1;
        }
        // wall gate calculations
        if (cycles % 5 === 0) {
            let opening = (PlayerProj.reserveCount >= 2 && Object.keys(Enemy.eDict).length === 0)
            for (let i = 0; i < gateArr.length; i++) {
                let gate = gateArr[i];
                let open = gate.openState === 0;
                if (opening) {
                    gate.openState--;
                    if (gate.openState < 0) gate.openState = 0;
                } else {
                    gate.openState++;
                    if (gate.openState > 7) gate.openState = 7;
                }
                if (open != (gate.openState === 0)) {
                    if (gate.openState === 0) {
                        gate.hb.enabled = false;
                        gate.trigger.enabled = false;
                    } else {
                        gate.hb.enabled = true;
                        gate.trigger.enabled = true;
                    }
                }
                gate.g.frameIndex = gate.openState;
            }
        }
    }

    stageBullets = function(cycles) {
        // spawn stage bullets
        if (cycles % 45 === 0) {
            spawnBullet(new MBullet(false, {
                pos: [6*256, 104*256],
                dir: 180,
                speed: 12*256/180,
                damage: 30,
                size: 5,
                type: MBullet.types.ball,
                color: [255, 0, 255],
                destroyable: false,
            }, [
                mod.moveTimer(180)
            ]))

            spawnBullet(new MBullet(false, {
                pos: [-6*256, 107*256],
                dir: 0,
                speed: 12*256/180,
                damage: 30,
                size: 5,
                type: MBullet.types.ball,
                color: [255, 0, 255],
                destroyable: false,
            }, [
                mod.moveTimer(180)
            ]))
        }
    }
}

export function healBoss(amount) {
    let e = Enemy.eDict[bossBarEnemyId];
    e.health += amount;
}
function loadStageForest() {
    Draw.grassVariant = 1;
    // play music
    Music.changeMusic("s2a");

    // for testing:
    //Player.pos = [-600, 28000]

    // spawns yyOrbs
    for (let i = 0; i < 2; i++) {
        let p = new PlayerProj(ce.move(Player.pos, Math.random()*360, Math.random*10+10), [0,0]);
        p.thrown = false;
        PlayerProj.projArr.push(p);
    }

    // blocks backtracking
    let returnBlocker = new MapObject([0,0], [], [new HitBox([-1000, -1000], [2000, 500], false)]);
    returnBlocker.colArr[0].river = true;

    // sanzu river
    let sanzuOffset = [0, -3000];
    let scale = 1;
    let gArr = [];
    for (let y = 0; y < 9; y++) {
        for (let x = -5; x <= 5; x++) {
            // add graphic
            gArr.push(new Graphic("sanzu/upper/"+((y === 8)? "shore" : "full"), ["floor"], ".png", scale, 2, 1, [-1024*scale+x*2048*scale, 1024*scale*y]));
        }
    }
    let hb1 = new HitBox([-5.5*2048*scale, 0], [5.5*2048*scale-96*8, 8.5*1024*scale]);
    let hb2 = new HitBox([96*8, 0], [5.5*2048*scale-96*8, 8.5*1024*scale]);
    hb1.river = true;
    hb2.river = true;
    let sanzu = new MapObject(sanzuOffset, gArr, [hb1, hb2], [-5.5*2048, 0, 5.5*2048, 9*1024]);
    let hbBack = new HitBox([-10000, -840], [20000, 100]);

    // energy cannon system
    let ecsScale = 2;
    let energyReciever = new MapObject([0, 6000], [
        new Graphic("energy_reciever", ["wall"], ".png", ecsScale, 4, 4, [-512*ecsScale, 0, 98*8*ecsScale], 1, null, false)
    ], [
        new HitBox([-512*ecsScale, 98*8*ecsScale], [1024*ecsScale, 77*8*ecsScale], true),
        new HitBox([-512*ecsScale+5*8*ecsScale, 41*8*ecsScale], [1024*ecsScale-10*8*ecsScale, 57*8*ecsScale], true)
    ], [
        -64*8*ecsScale, 41*8*ecsScale,
        64*8*ecsScale, 256*8*ecsScale,
    ]);

    let energyCannon = new MapObject([0, 23000], [
        new Graphic("energy_cannon", ["wall"], ".png", ecsScale, 4, 4, [-512*ecsScale, 0, 98*8*ecsScale], 1, null, false)
    ], [
        new HitBox([-512*ecsScale, 98*8*ecsScale], [1024*ecsScale, 77*8*ecsScale], true),
        new HitBox([-512*ecsScale+18*8*ecsScale, 0], [1024*ecsScale-36*8*ecsScale, 98*8*ecsScale], true)
    ], [
        -64*8*ecsScale, 0,
        64*8*ecsScale, 256*8*ecsScale,
    ]);

    let getSpireBounds = function() {
        return [-74*ecsScale*2, -37*4*ecsScale, 74*ecsScale*2, 232*ecsScale*4];
    }
    let sideTurretPos = [10000, 25000]
    let sideTurretL = new MapObject([sideTurretPos[0], sideTurretPos[1]], [
        new Graphic("core_spires/w", ["wall"], ".png", ecsScale*0.5, 2, 15, [-64*4*ecsScale, -37*4*ecsScale, 37*4*ecsScale], 1, null, false)
    ], [
        new HitBox([-24*4*ecsScale, -24*4*ecsScale], [48*4*ecsScale, 48*4*ecsScale], true, false),
        new HitBox([-10*4*ecsScale, -37*4*ecsScale], [20*4*ecsScale, 74*4*ecsScale], true, false),
        new HitBox([-37*4*ecsScale, -10*4*ecsScale], [74*4*ecsScale, 20*4*ecsScale], true, false),
    ], getSpireBounds());
    let sideTurretR = new MapObject([-sideTurretPos[0], sideTurretPos[1]], [
        new Graphic("core_spires/e", ["wall"], ".png", ecsScale*0.5, 2, 15, [-64*4*ecsScale, -37*4*ecsScale, 37*4*ecsScale], 1, null, false)
    ], [
        new HitBox([-24*4*ecsScale, -24*4*ecsScale], [48*4*ecsScale, 48*4*ecsScale], true, false),
        new HitBox([-10*4*ecsScale, -37*4*ecsScale], [20*4*ecsScale, 74*4*ecsScale], true, false),
        new HitBox([-37*4*ecsScale, -10*4*ecsScale], [74*4*ecsScale, 20*4*ecsScale], true, false),
    ], getSpireBounds());
    
    const corePos = [0, 29000]
    const coreDist = 1000

    let rsN = new RecallStatue([corePos[0], corePos[1]+coreDist*2])
    let rsS = new RecallStatue([corePos[0], corePos[1]-coreDist*2])
    let rsE = new RecallStatue([corePos[0]+coreDist*2, corePos[1]])
    let rsW = new RecallStatue([corePos[0]-coreDist*2, corePos[1]])

    let coreSpires = {
        north: new MapObject([corePos[0], corePos[1]+coreDist], [
            new Graphic("core_spires/n", ["wall"], ".png", ecsScale*0.5, 2, 15, [-64*4*ecsScale, -37*4*ecsScale, 37*4*ecsScale], 1, null, false)
        ], [
            new HitBox([-24*4*ecsScale, -24*4*ecsScale], [48*4*ecsScale, 48*4*ecsScale], true, false),
            new HitBox([-10*4*ecsScale, -37*4*ecsScale], [20*4*ecsScale, 74*4*ecsScale], true, false),
            new HitBox([-37*4*ecsScale, -10*4*ecsScale], [74*4*ecsScale, 20*4*ecsScale], true, false),
        ], getSpireBounds()),
        south: new MapObject([corePos[0], corePos[1]-coreDist], [
            new Graphic("core_spires/s", ["wall"], ".png", ecsScale*0.5, 2, 15, [-64*4*ecsScale, -37*4*ecsScale, 37*4*ecsScale], 1, null, false)
        ], [
            new HitBox([-24*4*ecsScale, -24*4*ecsScale], [48*4*ecsScale, 48*4*ecsScale], true, false),
            new HitBox([-10*4*ecsScale, -37*4*ecsScale], [20*4*ecsScale, 74*4*ecsScale], true, false),
            new HitBox([-37*4*ecsScale, -10*4*ecsScale], [74*4*ecsScale, 20*4*ecsScale], true, false),
        ], getSpireBounds()),
        east: new MapObject([corePos[0]-coreDist, corePos[1]], [
            new Graphic("core_spires/e", ["wall"], ".png", ecsScale*0.5, 2, 15, [-64*4*ecsScale, -37*4*ecsScale, 37*4*ecsScale], 1, null, false)
        ], [
            new HitBox([-24*4*ecsScale, -24*4*ecsScale], [48*4*ecsScale, 48*4*ecsScale], true, false),
            new HitBox([-10*4*ecsScale, -37*4*ecsScale], [20*4*ecsScale, 74*4*ecsScale], true, false),
            new HitBox([-37*4*ecsScale, -10*4*ecsScale], [74*4*ecsScale, 20*4*ecsScale], true, false),
        ], getSpireBounds()),
        west: new MapObject([corePos[0]+coreDist, corePos[1]], [
            new Graphic("core_spires/w", ["wall"], ".png", ecsScale*0.5, 2, 15, [-64*4*ecsScale, -37*4*ecsScale, 37*4*ecsScale], 1, null, false)
        ], [
            new HitBox([-24*4*ecsScale, -24*4*ecsScale], [48*4*ecsScale, 48*4*ecsScale], true, false),
            new HitBox([-10*4*ecsScale, -37*4*ecsScale], [20*4*ecsScale, 74*4*ecsScale], true, false),
            new HitBox([-37*4*ecsScale, -10*4*ecsScale], [74*4*ecsScale, 20*4*ecsScale], true, false),
        ], getSpireBounds())
    }

    let cshAlive = false;
    let cshId = null;
                
    let energyOriginY = energyCannon.pos[1]+37*8*ecsScale;
    let energyTargetY = energyReciever.pos[1]+(136+37)*8*ecsScale;

    // spirit bridge
    let sbData = buildSpiritBridge(sanzuOffset, 7);
    let spiritBridge = sbData.spiritBridge;
    let sbFloorArr = sbData.sbFloorArr;

    // notes
    let note5 = spawnNote([0, 6450], "Research Note 5", [
        "NThis bridge is far more futuristic yet beautiful than I could have ever anticipated. I will certainly need to make some sketches before I leave.",
        "NAnyways, at a cursory glance, this bridge looks to be powered by this towering contraption adjacent to it. This structure is absorbing spherical blasts to receive energy from far away--how clever.",
        "NIf I can find the source for this energy, I can perhaps use some of it to construct a portal back.",
        "N- Dr. Mori",
        "PMori's theory seems promising. There should be some more information from him near the origin of the blasts.",
        "PI think taking a side path may be necessary as these blasts look highly dangerous. I need to focus on reaching the origin, so I should {i}ignore spirits{/i} unless I really need to engage with them."
    ])

    let note7 = spawnNote([460, 22850], "Research Note 7", [
        "PThis note is labelled as the seventh note while the previous one was the fifth. Where's the missing note?",
        "NCatastrophe! The bridge is gone and there are spirits positively everywhere!",
        "NThey are all stuck in purgatory, unable to cross the Sanzu River due to my own actions. If I can return to the Core, I can restore the bridge--hopefully without any lasting damage.",
        "N- Dr. Mori",
        "PIs Mori responsible for the abundance of spirits on the way here? I can see what I presume to be the Core up ahead where I can hopefully find the truth."
    ])

    let note6 = spawnNote([-1000, 28000], "Research Note 6", [
        "NAfter a few days of research at what I now deem the “Core”, I have successfully created a portal back to the normal world.",
        "NBefore I go, I think I'll go back to the Sanzu River to draw some sketches of the bridge. Maybe I can even collect some samples of the odd contraption there.",
        "N-Dr. Mori",
        "PIt was the portal? I-",
        "C{i}--HUMAN INTEFERER DETECTED--ACTIVATING SELF DEFENSE PROTOCOLS--{/i}",
    ], function() {
        Music.changeMusic("s3b");
    })

    // forest
    // rfCanvas will represent right forest (will flip for left)
    let rfCanvas = ce.createCanvas(1750, 3200);
    let rfCtx = rfCanvas.getContext('2d');
    rfCtx.fillStyle = "rgb(255,0,0)";
    rfCtx.fillRect(0, 0, 1750, 3200); // 100% forest

    rfCtx.fillStyle = "rgb(10,0,0)";
    rfCtx.strokeStyle = "rgb(10,0,0)";

    let rsR0 = new RecallStatue([1000, 6100]);
    let rsL0 = new RecallStatue([-1000, 6100]);

    // circular chamber
    rfCtx.fillStyle = "rgb(64,0,0)";
    rfCtx.fillCircle(900, 900, 400);
    rfCtx.fillStyle = "rgb(10,0,0)";
    rfCtx.fillCircle(900, 900, 300);
    let ssR2 = new SaveStatue([9000, 13000]);
    let ssL2 = new SaveStatue([-9000, 13000]);
    let rsR2 = new RecallStatue([9000, 15000]);
    let rsL2 = new RecallStatue([-9000, 15000]);

    // bottom paths
    rfCtx.fillStyle = "rgb(0,0,0)";
    rfCtx.fillRect(0, 0, 300, 600);
    rfCtx.fillStyle = "rgb(10,0,0)";
    rfCtx.fillRect(300, 400, 600, 200);
    rfCtx.fillRect(900, 100, 100, 500);
    let rcR1 = new RecallStatue([8600, 11500])
    let rcL1 = new RecallStatue([-8600, 11500])
    let ssR1 = new SaveStatue([9500, 7700]);
    let ssL1 = new SaveStatue([-9500, 7700]);

    // diagonal middle to circular chamber path
    rfCtx.lineWidth = 200
    rfCtx.beginPath()
    rfCtx.moveTo(900, 900);
    rfCtx.lineTo(300, 1400);
    rfCtx.stroke();
    let ssR3 = new SaveStatue([4900, 18700]);
    let ssL3 = new SaveStatue([-4900, 18700]);
    let rsR3 = new RecallStatue([4000, 19500]);
    let rsL3 = new RecallStatue([-4000, 19500]);

    // circular central chamber
    rfCtx.fillStyle = "rgb(64,0,0)";
    rfCtx.fillCircle(0, 2300, 600);
    rfCtx.fillStyle = "rgb(0,0,0)";
    rfCtx.fillCircle(0, 2300, 500);

    // top paths
    rfCtx.fillStyle = "rgb(0,0,0)";
    rfCtx.fillRect(0, 1300, 400, 600);
    rfCtx.fillRect(0, 1850, 1000, 100); // FOR SIDE TURRETS

    // central path
    rfCtx.fillRect(0,0,50,2300);

    // flip right forest onto left and create full forest canvas
    let fCanvas = ce.createCanvas(3500, 3200);
    let fCtx = fCanvas.getContext('2d');
    fCtx.drawImage(rfCanvas, 1750, 0);
    fCtx.transform(-1, 0, 0, 1, 0, 0);
    fCtx.drawImage(rfCanvas, -1750, 0);

    forest.spawnForestFromCanvas(fCanvas, 1, [-17500, 6000], 10, 1);

    // SPAWN ENEMIES
    for (let i = 0; i < 5; i++) {
        // Right
        Enemy.spawnEnemy([3000+Math.random()*3000, 10000+Math.random()*2000], "neutral")
        Enemy.spawnEnemy([3000+Math.random()*3000, 10000+Math.random()*2000], "agony")
        // Left
        Enemy.spawnEnemy([-3000-Math.random()*3000, 10000+Math.random()*2000], "neutral")
        Enemy.spawnEnemy([-3000-Math.random()*3000, 10000+Math.random()*2000], "agony")
    }
    for (let i = 0; i < 3; i++) {
        // Right
        Enemy.spawnEnemy([2000+Math.random()*1000, 8000+Math.random()*2000], "sorrow")
        // Left
        Enemy.spawnEnemy([-3000-Math.random()*1000, 8000+Math.random()*2000], "sorrow")
    }

    for (let i = 0; i < 2; i++) {
        // Right
        Enemy.spawnEnemy([9500, 9500], "rage")
        Enemy.spawnEnemy([9500, 8200], "neutral")
        Enemy.spawnEnemy([9500, 8000], "agony")
        // Left
        Enemy.spawnEnemy([-9500, 9500], "rage")
        Enemy.spawnEnemy([-9500, 8200], "neutral")
        Enemy.spawnEnemy([-9500, 8000], "agony")
    }

    for (let i = 0; i < 3; i++) {
        // Right
        Enemy.spawnEnemy(ce.move([9000, 15000], Math.random()*360, Math.random()*4000), "neutral")
        Enemy.spawnEnemy(ce.move([9000, 15000], Math.random()*360, Math.random()*4000), "agony")
        Enemy.spawnEnemy(ce.move([9000, 15000], Math.random()*360, Math.random()*4000), "sorrow")
        Enemy.spawnEnemy(ce.move([9000, 15000], Math.random()*360, Math.random()*4000), "regret")
        Enemy.spawnEnemy(ce.move([9000, 15000], Math.random()*360, Math.random()*4000), "evil")
        // Left
        Enemy.spawnEnemy(ce.move([-9000, 15000], Math.random()*360, Math.random()*4000), "neutral")
        Enemy.spawnEnemy(ce.move([-9000, 15000], Math.random()*360, Math.random()*4000), "agony")
        Enemy.spawnEnemy(ce.move([-9000, 15000], Math.random()*360, Math.random()*4000), "sorrow")
        Enemy.spawnEnemy(ce.move([-9000, 15000], Math.random()*360, Math.random()*4000), "regret")
        Enemy.spawnEnemy(ce.move([-9000, 15000], Math.random()*360, Math.random()*4000), "evil")
    }

    for (let i = 0; i < 2; i++) {
        // Right
        Enemy.spawnEnemy(ce.move([5800, 18000], Math.random()*360, Math.random()*200), "evil")
        Enemy.spawnEnemy(ce.move([5800, 18000], Math.random()*360, Math.random()*200), "sorrow")
        // Left
        Enemy.spawnEnemy(ce.move([-5800, 18000], Math.random()*360, Math.random()*200), "evil")
        Enemy.spawnEnemy(ce.move([-5800, 18000], Math.random()*360, Math.random()*200), "sorrow")
    }

    for (let i = 0; i < 1; i++) {
        // Right
        Enemy.spawnEnemy([4000, 19000], "rage")
        // Left
        Enemy.spawnEnemy([-4000, 19000], "rage")
    }

    for (let i = 0; i < 5; i++) {
        // Right
        Enemy.spawnEnemy([1000+Math.random()*3000, 19000+Math.random()*6000], "neutral")
        Enemy.spawnEnemy([1000+Math.random()*3000, 19000+Math.random()*6000], "neutral")
        Enemy.spawnEnemy([1000+Math.random()*3000, 19000+Math.random()*6000], "sorrow")
        Enemy.spawnEnemy([1000+Math.random()*3000, 19000+Math.random()*6000], "regret")
        // Left
        Enemy.spawnEnemy([-1000-Math.random()*3000, 19000+Math.random()*6000], "neutral")
        Enemy.spawnEnemy([-1000-Math.random()*3000, 19000+Math.random()*6000], "neutral")
        Enemy.spawnEnemy([-1000-Math.random()*3000, 19000+Math.random()*6000], "sorrow")
        Enemy.spawnEnemy([-1000+Math.random()*3000, 19000+Math.random()*6000], "regret")
    }

    const mScale = 0.5;
    let mori = new MapObject([0, 27600], [
        new Graphic("mori", ["wall"], ".png", mScale, 1, 0, [-36*4*mScale, 0], undefined, undefined, false)
    ], [
        new HitCircle([0,0], 7*8*mScale, true)
    ], [
        -36*4*mScale,
        -7*8*mScale,
        36*4*mScale,
        432*mScale
    ]);
    mori.hidden = true;

    // DIALOG AND BOSS AND CORE STUFF
    let coreSpireEnemy;
    let bossStarted = false;
    let bossCycles = 0;
    let lastCycleBossHealth = null;
    let coreState = 2; // 2 == fully on, 0 == off, 1 == half power
    let decreaseWhiteOut = false;
    let portalOn = false;
    let portalFade = false;
    const portalPos = [0, 33700]
    let portalTrigger = new Trigger([
        new HitCircle(portalPos, 500)
    ], function() {
        Dialog.call("The disturbance seems to be accounted for. It is a tragedy that Mori must bear the weight of my actions however.");
        Dialog.call("Staying won't help him though; it's time to return to the normal world.", 0, undefined, undefined, function() {
            Player.disableControl = true;
            portalFade = true;
            decreaseWhiteOut = false;
        })
    }, false, false, "Press {i}E{/i} to Enter Portal")
    portalTrigger.enabled = false;
    stageCalc = function(cycles) {
        // decrease whiteout
        if (decreaseWhiteOut) {
            whiteOutAlpha -= 1/120;
            if (whiteOutAlpha <= 0) {
                whiteOutAlpha = 0;
                decreaseWhiteOut = false;
            }
        }
        if (portalFade) {
            whiteOutAlpha += 1/120;
            if (whiteOutAlpha >= 1) {
                whiteOutAlpha = 1;
                // END GAME
                Stage.clearStage();
                MainLoop.activeScene = "end";
            }
        }

        // spirit bridge animation
        for (let i = 0; i < sbFloorArr.length; i++) {
            sbFloorArr[i].alpha = 0.5+Math.sin(cycles*Math.PI/60)*0.1;
        }
    }


    // boss save data
    let bossPhase = 0;
    let overDriveCheckpoint = false;
    Save.saveFunctArr.push(function(sd) {
        sd.bossPhase = bossPhase;
    })
    Save.loadFunctArr.push(function(sd) {
        bossPhase = sd.bossPhase;
        bossCycles = 0;
    })

    stageBullets = function(cycles) {
        // make spires an enemy
        if (!bossStarted && note6.mo.gArr[0].frameIndex != null) {
            bossStarted = true;
            // disable coreSpire hitboxes and add coreSpire hitboxes to coreSpireEnemy
            let cshColArr = [];
            energyCannon.gArr[0].behindFade = true;
            for (let id in coreSpires) {
                let mo = coreSpires[id];
                mo.gArr[0].behindFade = true;
                for (let i = 0; i < mo.colArr.length; i++) {
                    let col = mo.colArr[i];
                    let eCol = col.clone();
                    eCol.enemy = true;
                    eCol.pos[0] -= corePos[0];
                    eCol.pos[1] -= corePos[1];
                    cshColArr.push(eCol);
                    col.enabled = false;
                }
            }

            for (let id in Enemy.eDict) {
                Enemy.eDict[id].health = 0;
            }
            coreSpireEnemy = new Enemy([corePos[0], corePos[1]], 2500, cshColArr, {}, function(self, cycles) {
                // move funct
            }, function(self, cycles) {
                // bullet funct
            }, null, undefined, undefined, true, true);
            cshAlive = true;
            cshId = coreSpireEnemy.id;
            note6.trigger.enabled = false;
            bossBarEnemyId = coreSpireEnemy.id;
            console.log("Spires Spawned");
            Save.save();
        }

        // test if spires defeated
        if (cshAlive && (!(cshId in Enemy.eDict) || Enemy.eDict[cshId].health <= 0)) {
            console.log("Spires Defeated")
            bossBarEnemyId = null;
            cshAlive = false;
            energyCannon.gArr[0].behindFade = false;
            for (let id in coreSpires) {
                let mo = coreSpires[id];
                mo.gArr[0].behindFade = false;
                for (let i = 0; i < mo.colArr.length; i++) {
                    let col = mo.colArr[i];
                    col.enabled = true;
                }
            }
            Music.changeMusic("")
            Sound.sounds.boom.play();
            Dialog.call("{i}--CRITICAL ERROR--CORE CONDITION UNSTABLE--{s}EMERGENCY SHUTDOWN ENGAGED{/s}--{/i}", 4, undefined, function() {
                sbData.disable();
                coreState = 0;
                whiteOutAlpha = 1;
                Player.shakeMulti = 0;
                MBullet.bArr = [];
                Player.pos = [0, 27300];
                Player.moveVelo = [0,0];
                Player.spriteDir = "up";
                mori.hidden = false;
            }, function() {
                decreaseWhiteOut = true;
            });
            Dialog.call("What have you done?! I need to see how much damage you caused. Who are you?", 3);
            Dialog.call("I was investigating a spiritual disturbance at the local shrine and I was transported to this realm. You're Dr. Mori, correct?", 0, undefined, function() {
                Music.changeMusic("s3a")
            });
            Dialog.call("Sigh, I am indeed Dr. Mori. I assume you read my journal notes, and I already know what your next question is.", 3);
            Dialog.call("The Core is the power generator of the spirit realm. My creation of the portal consumed too much power and caused the Core to become functionally disabled.", 3);
            Dialog.call("The Sanzu River Bridge failed immediately afterwards.", 3);
            Dialog.call("That must be the disturbance then.")
            Dialog.call("Yes, a drop in energy of such magnitude within this realm has extreme consequences.", 3);
            Dialog.call("The spirits were unable to cross the Sanzu River since the bridge no longer existed. They all became vengeful out of sorrow, pain, and rage. Their families on this side of the river likewise became bereaved due to the separation.", 3);
            Dialog.call("But the bridge was still there when I reached the Sanzu River. Why can't the spirits cross the bridge?");
            Dialog.call("I had the same confusion. When I repaired the Core and reactivated the bridge, I tried to inform the spirits that they could cross into the afterlife again.", 3);
            Dialog.call("To my dismay, they were permanently unable to leave the regions they were trapped in for reasons outside of my knowledge.", 3);
            Dialog.call("Due to your work, the bridge is once more deactivated. More spirits are becoming trapped as we speak.", 3, undefined, function() {
                // pan to bridge
                changeZoom(1/3);
                Player.offsetTarget = [0, -27300];
                Player.offset = [0, -22300];
                sbData.disable();
            }, function() {
                // pan back
                changeZoom(3);
                Player.offsetTarget = [0, 0];
                Player.offset = [0, -5000];
            });
            Dialog.call("I apologize deeply for causing this, but why was I attacked by the Core?");
            Dialog.call("I created a defense system to ensure that the Core was well protected. That has clearly failed.", 3);
            Dialog.call("Anyways, I think the Core is now stable enough to keep the Sanzu River Bridge secure for now, but its power capacity is still far below normal as you can see.", 3, undefined, function() {
                // pan to spires
                coreState = 1;
                changeZoom(1/3);
                Player.offsetTarget = [0, corePos[1]-27300];
                sbData.enable();
                portalOn = true;
                portalTrigger.enabled = true;
            }, function() {
                // pan back
                changeZoom(3);
                Player.offsetTarget = [0, 0];
            });
            Dialog.call("To prevent further disaster, I think it is best if you leave. The portal I created is still there behind the Core. But like how the shrine only transports people here to the spirit realm, that portal can only take you back to the mortal realm.", 3, undefined, function() {
                // pan to portal
                changeZoom(1/2);
                Player.offsetTarget = [portalPos[0], portalPos[1]-27300];
            }, function() {
                // pan back
                changeZoom(2);
                Player.offsetTarget = [0, 0];
            })
            Dialog.call("What's going to happen to you?");
            Dialog.call("Well, that portal only has the energy to transport one person. Until I figure out how to create a portal without simultaneously destroying the Sanzu River Bridge, I will remain here.", 3);
            Dialog.call("Though, that research has been set back due to the present state of the Core. If you are concerned about my safety, I will be fine, especially once you go. Now, let me focus on these repairs.", 3);
        }

        // update core graphics
        for (let id in coreSpires) {
            let mo = coreSpires[id];
            for (let i = 0; i < mo.gArr.length; i++) {
                let g = mo.gArr[i];
                switch(coreState) {
                    case 0:
                        g.frameIndex = 1;
                        g.fps = 0;
                        break;
                    case 1:
                        g.frameIndex = null;
                        g.fps = 7.5;
                        break;
                    case 2:
                        g.frameIndex = null;
                        g.fps = 15;
                        break;
                }
            }
        }

        if (coreState > 0 && cycles % 180 === 0) {
            // energy cannon bullets
            spawnBullet(new MBullet(false, {
                pos: [0, energyOriginY],
                dir: -90,
                speed: 0,
                damage: 10000,
                destroyable: false,
                type: MBullet.types.ball,
                color: [128,0,255],
                size: 1,
                shadow: false,
                height: 0,
            }, [
                mod.moveIntervalFunction(function(self) {
                    self.size += (40 - self.size)*0.02;
                    // distance dependent shaking
                    let distance = ce.distance(self.pos, Player.pos)
                    if (Player.shakeCycle != MainLoop.cycles) {
                        Player.shakeMulti = 0;
                        Player.shakeCycle = MainLoop.cycles;
                    }
                    let shakeMulti = 2000/(10+(distance/150)**2);;
                    if (Player.shakeMulti < shakeMulti)
                        Player.shakeMulti = shakeMulti;
                }, 0, 0),
                mod.moveIntervalFunction(function(self) {
                    Sound.sounds.eardeth.play(self, undefined, true);
                }, 120, 120),
                mod.moveIntervalFunction(function(self) {
                    Sound.sounds.coreCannonBlast.play(self.pos);
                    self.speed = (energyOriginY-energyTargetY)/120;
                }, 120, 120),
                mod.moveTimer(240)
            ]));
        }
        
        if (cycles % 150 === 0) {
            // core sound
            Sound.sounds.eardeth.play(corePos, 0.1*coreState**2)
        }
        if (coreState > 0 && cycles % 6 === 0) {
            // core bullet
            spawnBullet(new MBullet(false, {
                pos: [corePos[0], corePos[1]],
                dir: 0,
                speed: 0,
                type: MBullet.types.ball,
                color: [Math.random()*128+127,0,255],
                size: (10+Math.random()*5)*coreState,
                shadow: false,
                height: 1000,
                indicator: true,
                alpha: 1,
            }, [
                mod.moveIntervalFunction(function(self) {
                    self.size += (30 * coreState - self.size)*0.01;
                    let distance = ce.distance(self.pos, Player.pos)
                    if (Player.shakeCycle != MainLoop.cycles) {
                        Player.shakeMulti = 0;
                        Player.shakeCycle = MainLoop.cycles;
                    }
                    let shakeMulti = 1000*coreState/(10+(distance/150)**2);;
                    if (Player.shakeMulti < shakeMulti)
                        Player.shakeMulti = shakeMulti;
                }, 0, 0),
                mod.moveTimer(30)
            ]))
        }

        if (portalOn) {
            if (cycles % 150 === 0) {
                // portal sound
                Sound.sounds.earhurt.play(portalPos, 0.1)
            }
            // portal bullet
            spawnBullet(new MBullet(false, {
                pos: [portalPos[0], portalPos[1]],
                dir: 0,
                speed: 0,
                type: MBullet.types.ball,
                color: [0,Math.random()*255,255],
                size: 10,
                shadow: false,
                height: 0,
                indicator: true,
                alpha: 1,
            }, [
                mod.moveIntervalFunction(function(self) {
                    self.size += (5 - self.size)*0.01;
                    let distance = ce.distance(self.pos, Player.pos)
                    if (Player.shakeCycle != MainLoop.cycles) {
                        Player.shakeMulti = 0;
                        Player.shakeCycle = MainLoop.cycles;
                    }
                    let shakeMulti = 500/(10+(distance/150)**2);;
                    if (Player.shakeMulti < shakeMulti)
                        Player.shakeMulti = shakeMulti;
                }, 0, 0),
                mod.moveTimer(30)
            ]))
        }

        // BOSS FIGHT
        if (cshAlive && Dialog.activeDialog == null) {
            coreSpireEnemy = Enemy.eDict[bossBarEnemyId]
            // check for phase change
            if (overDriveCheckpoint && coreSpireEnemy.health > coreSpireEnemy.maxHealth * 0.6) {
                coreSpireEnemy.health = coreSpireEnemy.maxHealth * 0.6;
                lastCycleBossHealth = coreSpireEnemy.health;
            }
            let phaseChange = false;
            let healthProp = coreSpireEnemy.health / coreSpireEnemy.maxHealth;
            if (bossPhase === 0 && healthProp <= 0.75) {
                bossPhase++;
                phaseChange = true;
                Dialog.call("{i}--DEPLOYING SPIRIT RECOVERY RESERVES--{/i}", 4);
            }
            if (bossPhase === 1 && healthProp <= 0.6) {
                bossPhase++;
                phaseChange = true;
                Dialog.call("{i}--OVERDRIVE MODE TRIGGERED--{/i}", 4);
                overDriveCheckpoint = true;
                killMiniSpires();
                Save.save();
            }
            if (bossPhase === 2 && healthProp <= 0.1) {
                bossPhase++;
                phaseChange = true;
                Dialog.call("{i}--SPIRE DAMAGE CRITICAL--AUXILERY FUNCTIONS OFFLINE--{/i}", 4);
            }
            if (phaseChange) {
                for (let i = 0; i < MBullet.bArr.length; i++) {
                    MBullet.bArr[i].alive = false;
                }
                bossCycles = 0;
            }

            // boss attack
            if (bossCycles === 0) {
                bossCycles++;
                return;
            }
            bossAttack(bossPhase, bossCycles, coreSpires, corePos);
            bossCycles++;

            // damage spark bullets
            if (lastCycleBossHealth != null && coreSpireEnemy.health < lastCycleBossHealth) {
                for (let id in coreSpires) {
                    let cs = coreSpires[id];
                    for (let i = 0; i < Math.round(0.5*(lastCycleBossHealth - coreSpireEnemy.health)); i++) {
                        spawnBullet(new MBullet(false, {
                            pos: [cs.pos[0], cs.pos[1]],
                            dir: null,
                            speed: 20+Math.random()*20,
                            type: MBullet.types.rice,
                            color: [255,Math.floor(Math.random()*255),0],
                            damage: 5,
                            size: 1+Math.random()*2,
                            ignoreWalls: true,
                        }, [
                            mod.moveTimer(30+Math.floor(Math.random()*60)),
                            mod.moveAccel(-0.5,5+ Math.random()*10, 5),
                        ]))
                    }
                }
            }
            lastCycleBossHealth = coreSpireEnemy.health;
        }
    }
}