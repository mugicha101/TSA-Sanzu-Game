import { MainLoop, Draw, zoom, debug } from './main.js'
import { Graphic, MapObject } from './mapObj.js';
import * as ce from './canvasExtension.js';
import {Collision, HitBox, HitCircle} from './collisions.js';
import * as inp from './input.js';
import { inputs } from './input.js';
export {playerImgDict, playerDim, PlayerProj, Player};
import { Dialog } from './dialog.js';
import { Save } from './save.js';

const canvas = ce.canvas
canvas.style.cursor = 'none';
const c = canvas.getContext("2d", { alpha: false })

const playerImgDict = {}
const playerDim = [160, 288];
const dirArr = ["up", "down", "right", "left"]
dirArr.forEach(function(dir, index) {
    playerImgDict[dir] = [];
    for (let i = 0; i < 4; i++) {
        let img = new Image();
        img.src = `../graphics/player/boy/${dir}${i}.png`
        playerImgDict[dir].push(img)
    }
})

const Player = { // holds player data
    pos: [0, 0],
    camPos: [0, 0],
    camPosTarget: [0, 0], // before shake offset and normal offset is applied
    shakeOffset: [0, 0],
    offset: [0, 0],
    offsetTarget: [0, 0],
    shakeMulti: 0,
    shakeCycle: 0,
    shakeRandObjs: [new SimplexNoise(),new SimplexNoise()],
    speed: 2,
    lastCycleHealth: 100,
    health: 200,
    maxHealth: 200,
    regenPause: 0,
    moveVelo: [0, 0],
    disableControl: false,
    hbDim: [50, 50],
    hc: null,
    dir: 0,
    spriteDir: "down",
    spriteMoveCycle: 0,
    hcIdStr: null,
    farSightMode: false,
    healthBarImg: null,
    dmgSegArr: [],
    fullHealthTimer: 0,
    updateHitbox: function () {
        for (let i = 0; i < 2; i++) {
            //Collision.objDict[Player.hb.id].pos[i] = Player.pos[i]-Player.hbDim[i]/2
            Collision.objDict[Player.hc.id].pos[i] = Player.pos[i]
        }
    },
    init: function() {
        // add player hitobjects
        //Player.hb = new HitBox([-Player.hbDim[0]/2,-Player.hbDim[1]/2], [Player.hbDim[0], Player.hbDim[1]], false)
        Player.hc = new HitCircle([Player.pos[0], Player.pos[1]], Player.hbDim[0] / 2, false);

        //Player.hbIdStr = Player.hb.id.toString();
        Player.hcIdStr = Player.hc.id.toString();
        Player.healthBarImg = new Image();
        Player.healthBarImg.src = "../graphics/health_bar.png";
    },
    draw: function () { // draws the player
        c.resetTrans();
        Draw.camCanvasOffset();
        c.fillStyle = "rgb(0,0,0)";
        c.globalAlpha = 0.5;
        c.fillCircle(Player.pos[0], -Player.pos[1], 25);
        c.globalAlpha = 1;
        const pScale = 0.5
        c.transformCanvas(pScale, 0, Player.pos[0] - pScale * playerDim[0] / 2, -Player.pos[1] - pScale * playerDim[1] / 2 - 65)
        c.drawImage(playerImgDict[Player.spriteDir][Math.floor(Player.spriteMoveCycle / 6) % 4], 0, 0)
    },
    move: function() {
        // reduce velocity (take into account ground textures)
        let grip = 0.75;
        for (let i = 0; i < 2; i++) {
            Player.moveVelo[i] *= grip;
        }

        // get speed (take into account ground textures)
        let speed = Player.speed;
        let speedMulti = 1;
        if (inputs.sprint.pressed) {
            speedMulti *= 2;
            if (debug) speed *= 5;
        }
        if (inputs.leftClick.pressed && PlayerProj.reserveCount > 0) {
            speedMulti *= 0.5;
        }
        speed *= speedMulti;

        // get player move vector
        let moveVector = [0, 0]
        if (Dialog.activeDialog == null && !Player.disableControl) {
            if (inputs.up.pressed) {
                moveVector[1]++;
            }
            if (inputs.down.pressed) {
                moveVector[1]--;
            }
            if (inputs.left.pressed) {
                moveVector[0]--;
            }
            if (inputs.right.pressed) {
                moveVector[0]++;
            }
        } else {
            Player.farSightMode = false;
        }

        // change player velocity (or camera if farsight)
        if (moveVector[0] != 0 || moveVector[1] != 0) {
            
            if (Player.farSightMode) {
                for (let i = 0; i < 2; i++) {
                    Player.camPosTarget[i] += moveVector[i]*15;
                    if (Math.abs(Player.camPosTarget[i]-Player.pos[i]) > 500) {
                        Player.camPosTarget[i] = Player.pos[i] + 500*Math.sign(Player.camPosTarget[i]-Player.pos[i])
                    }
                }
            } else {
                let moveDir = ce.dirToTarget([0, 0], moveVector);
                let moveOffset = ce.move([0, 0], moveDir, speed);
                for (let i = 0; i < 2; i++) {
                    Player.moveVelo[i] += moveOffset[i];
                }
            }
        }

        // change player sprite
        if (!Player.farSightMode) {
            if (moveVector[0] === 1) {
                Player.spriteDir = "right";
            } else if (moveVector[0] === -1) {
                Player.spriteDir = "left";
            }

            if (moveVector[1] === 1) {
                Player.spriteDir = "up";
            } else if (moveVector[1] === -1) {
                Player.spriteDir = "down";
            }
        }

        if (Player.farSightMode || (moveVector[0] === 0 && moveVector[1] === 0)) {
            Player.spriteMoveCycle = 0;
        } else {
            Player.spriteMoveCycle += speedMulti;
        }

        // NOTE: COLLISION STILL BUGGY IF PLAYER MOVING INTO A MOVING HITBOX
        // pre-movement collision detection
        function playerCollision() {
            if (debug) return true;
            let colData = MapObject.moveCollision(Player.pos, Player.hc);
            Player.pos = colData.pos;
            Player.updateHitbox();
            return colData.notCollided;
        }

        let count = 0;
        let notCollided = false;
        while (count < 5 && !notCollided) {
            count++;
            notCollided = playerCollision();
        }

        // change player position as well as do collision detection
        for (let i = 0; i < 2; i++) {
            Player.pos[i] += Player.moveVelo[i];
            Player.updateHitbox();
            playerCollision();
        }

        // auto-center camera to player
        if (!Player.farSightMode) {
            for (let i = 0; i < 2; i++) {
                Player.camPosTarget[i] += (Player.pos[i] - Player.camPosTarget[i]) * 0.15
            }
        }

        // calculate shake offset
        for (let i = 0; i < 2; i++) {
            Player.shakeOffset[i] = Player.shakeRandObjs[i].noise2D(MainLoop.cycles/3, 0)*Player.shakeMulti;
        }

        // change offset
        for (let i = 0; i < 2; i++) {
            let step = (Player.offsetTarget[i]-Player.offset[i])*0.1;
            if (Math.abs(step) > 500) step = Math.sign(step)*500;
            Player.offset[i] += step;
        }

        // apply offset to camera
        for (let i = 0; i < 2; i++) {
            Player.camPos[i] = Player.camPosTarget[i] + Player.shakeOffset[i] + Player.offset[i];
        }

        // player direction
        let mc = ce.flipY(inp.mouseCoords)
        for (let i = 0; i < 2; i++) {
            mc[i] /= zoom;
        }
        Player.dir = ce.dirToTarget([Player.pos[0] - Player.camPos[0], Player.pos[1] - Player.camPos[1]], mc);
    },
    updateHealth: function() {
        // update damage segments
        for (let i = 0; i < Player.dmgSegArr.length; i++) {
            let seg = Player.dmgSegArr[i];
            seg.time++;
            if (seg.time >= 30) {
                Player.dmgSegArr.splice(i, 1);
                i--;
            }
        }

        if (Dialog.activeDialog == null) {
            // check if health changed
            if (Player.health < Player.lastCycleHealth) {
                Player.farSightMode = false;

                // create damage segments
                if (Player.health < 0) Player.health = 0;
                Player.dmgSegArr.push({
                    lowBound: Player.health,
                    size: Player.lastCycleHealth - Player.health,
                    time: 0
                })
            }
            Player.lastCycleHealth = Player.health;

            if (Player.health >= Player.maxHealth) Player.fullHealthTimer++;
            else Player.fullHealthTimer = 0;

            // player health regen
            if (Player.health <= 0) {
                // player death here
                Player.health = 0;
                Save.load();
            }
            if (Player.regenPause === 0) Player.health += Player.maxHealth/(60*20);
            if (Player.health > Player.maxHealth) {
                Player.health = Player.maxHealth;
            }
            if (Player.regenPause > 30) Player.regenPause = 30;
            Player.regenPause -= 0.2;
            if (Player.regenPause < 0) Player.regenPause = 0;
        }
    }
}

class PlayerProj { // player projectiles
    static projArr = [] // stores all active playerproj objects
    static graphic = null
    static projCount = 0; // allows unique id for projMR of bullets
    static charge = 0;
    static thrownCount = 0;
    static reserveCount = 0;
    height = 0 // if 0, is on ground, if above 0, is in air
    pos = [0, 0] // x,y position
    velo = [0, 0] // x,y velocity
    hVelo = 0 // height velocity
    groundTime = 0; // time on ground
    homing = false; // whether proj is homing on closest enemy while in air
    #thrown = false; // if thrown, is in the air and dealing damage, if not thrown, will stay around player
    static init() {
        PlayerProj.graphic = new Graphic("yyOrb", ["proj"], ".png", 1, 8, 16);
    }
    constructor(initPos, initVelo) {
        this.thrown = true;
        this.height = 0;
        this.pos = ce.cloneObj(initPos);
        this.hVelo = 0;
        this.groundTime = 1;
        this.velo = ce.cloneObj(initVelo);
        this.firstPickup = false;
        PlayerProj.reserveCount++;
        PlayerProj.projCount++;
    }
    draw() {
        c.resetTrans();
        Draw.camCanvasOffset();
        const scale = 0.35
        c.fillStyle = "rgb(0,0,0)";
        c.transformCanvas(scale, 0, this.pos[0], this.pos[1])
        // yyOrb
        let dim = PlayerProj.graphic.getDim();
        c.drawImage(PlayerProj.graphic.getImage(), -dim[0] / 2, -dim[1] * 0.8 - this.height * 10)
    }
    drawShadow() {
        c.resetTrans();
        Draw.camCanvasOffset();
        const scale = 0.35
        c.transformCanvas(scale, 0, this.pos[0], this.pos[1])
        // pickup radius/bullet cancel radius
        if (this.groundTime > 0) {
            c.globalAlpha = (0.5 - Math.cos(this.groundTime / 5) * 0.15)
            let rad = 150 / scale * (1 - 1 / (this.groundTime / 10 + 9 / 10))
            c.fillStyle = "rgb(255,0,0)"
            let color = ce.getColor(this.groundTime * 0.05);
            let grad = c.createRadialGradient(0, 0, 0, 0, 0, rad)
            grad.addColorStop(0, "rgba(255,255,255,255)");
            grad.addColorStop(0.5, `rgba(${color.r},${color.g},${color.b},255)`);
            grad.addColorStop(1, `rgba(${color.r},${color.g},${color.b},0)`);
            c.fillStyle = grad;
            c.fillCircle(0, 0, rad);
            c.fillStyle = "rgb(0,0,0)";
            let amount = 32;
            for (let i = 0; i < amount; i++) {
                let pos = ce.move([0, 0], this.groundTime + 360 * i / amount, rad)
                c.fillCircle(pos[0], pos[1], 10)
                pos = ce.move([0, 0], this.groundTime + 360 * i / amount, rad * 0.8)
                c.fillCircle(pos[0], pos[1], 10)
            }
            c.fillStyle = "rgb(255,255,255)";
            amount = 16;
            for (let i = 0; i < amount; i++) {
                let pos = ce.move([0, 0], -this.groundTime + 360 * i / amount, rad * 0.9)
                c.fillCircle(pos[0], pos[1], 20)
            }
            c.transformCanvas(1, this.groundTime * 0.5, 0, 0);
            c.strokeStyle = `rgb(${color.r},${color.g},${color.b})`;
            c.lineWidth = 10;
            c.globalAlpha = 0.25;
            c.beginPath();
            const rectSize = rad * 1.5 * (1 + 0.1 * Math.sin(this.groundTime * 0.05))
            for (let i = 0; i < 2; i++) {
                c.transformCanvas(1, 45, 0, 0);
                c.rect(-rectSize * 2, -rectSize * 2, rectSize * 4, rectSize * 4);
                c.rect(-rectSize, -rectSize, rectSize * 2, rectSize * 2);
            }
            c.stroke();
        }
        // shadow
        c.fillStyle = "rgb(0,0,0)";
        c.globalAlpha = 0.5;
        c.fillCircle(0, 0, 50 - this.height);
    }
    set thrown(thrown) {
        if (this.#thrown != thrown) {
            if (thrown) {
                this.homing = true;
                PlayerProj.thrownCount++;
                PlayerProj.reserveCount--;
            } else {
                PlayerProj.thrownCount--;
                PlayerProj.reserveCount++;
            }
            this.#thrown = thrown;
        }
    }
    get thrown() {
        return this.#thrown;
    }
}