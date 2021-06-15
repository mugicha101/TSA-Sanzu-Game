import * as mod from "./bulletMods.js"
import * as ce from "./canvasExtension.js"
import {Collision, HitBox, HitCircle} from './collisions.js';
import {MainLoop, Draw, debug, zoom} from "./main.js"
import {Player, PlayerProj} from "./player.js"
import {Sound} from './audio.js'
import {RenderObj} from "./renderOrder.js";
import {MapObject} from "./mapObj.js"
import {Dialog} from "./dialog.js"
export {MBullet, spawnRing, spawnBullet, drawBullets, drawBullet, moveBullets, drawBulletShadows}
const canvas = ce.canvas
const c = canvas.getContext("2d", {alpha: false})
const pHitboxRadius = 25;

class MBullet {
    static bArr = [];
    /*
    CONSTRUCTOR:
    constructor(laser=false, props={}, mods=[])

    SHARED PROPERTIES:
    pos (float arr[2]): position of object (default: [0,0])
    dir (float): direction of object (default null aka random)
    color (int/float arr[3]): color of object [r,g,b] (default [255,0,0])
    size (float): size mutiplier of object (default: 1.0)
    damage (float): damage of object (if laser, per tick) (default 1.0)
    indicator (bool): whether object can hit player or is an intangible indicator, basically indicators are warning signs (default: false)
    alpha (float): opacity of object (default: 1.0 if not indicator, 0.5 if indicator)
    groupId (anything but usually int): identifier if associating object to a group (default null)

    BULLET PROPERTIES:
    type (str): type of bullet (default: "orb", use MBullet.types dict)
    speed (float): speed of bullet (default: 5.0)
    destroyable (bool): whether the bullet can be destroyed by yy orbs and walls (default: true)
    ignoreWalls (bool): wether the bullet can be destroybed by walls (default: false)
    height (float): render height of bullet from ground (default: 50)
    shadow (boole): whether the bullet has a shadow (default: true)

    LASER PROPERTIES:
    duration (int): duration of laser in ticks (default: 60)
    length (float): length of laser (default: 1000)
    spawnAnimation (bool): whether the laser starts small and grows into full laser within 5 frames or starts at full size (default: true)
    */

    // NOTE: CURRENTLY LASER NOT IMPLEMENTED
    constructor(laser=false, props={}, mods=[]) {
        // DEFAULT PROP VALUES
        // default value adder function
        function propDefault(key, defaultVal) {
            if (!(key in props)) {
                props[key] = defaultVal;
            }
        }
        // shared props
        propDefault("pos", [0,0]);
        propDefault("dir", null);
        propDefault("color", [255,0,0]);
        propDefault("size", 1.0);
        propDefault("damage", 1.0);
        propDefault("indicator", false);
        propDefault("alpha", (props.indicator)? 0.5 : 1.0);
        propDefault("groupId", null);
        if (!laser) { // bullet props
            propDefault("type", MBullet.types.orb);
            propDefault("speed", 5.0);
            propDefault("destroyable", true);
            propDefault("ignoreWalls", false);
            propDefault("shadow", true);
            propDefault("height", 50);
        } else { // laser props
            propDefault("duration", 60);
            propDefault("length", 1000);
            propDefault("spawnAnimation", true);
        }
        // ADD FIELDS
        // universal fields
        this.aliveTime = 0;
        this.alive = true;
        this.deathFade = 0;
        
        // shared prop fields
        this.laser = laser;
        this.pos = props.pos;
        if (props.dir == null) {
            props.dir = Math.random()*360;
        }
        this.dir = props.dir;
        this.initialPos = props.pos;
        this.initialDir = props.dir;
        this.rotPrevPos = props.pos;
        this.renderDir = props.dir;
        this.rotDir = props.dir;
        this.damage = props.damage;
        this.rgbArr = props.color;
        this.size = props.size;
        this.groupId = props.groupId;
        this.indicator = props.indicator;
        this.alpha = props.alpha;

        // bullet prop fields
        this.type = props.type;
        this.speed = props.speed;
        this.destroyable = props.destroyable;
        //this.timeSinceLastCheck = 100;
        this.shadow = props.shadow;
        this.height = props.height;
        this.ignoreWalls = props.ignoreWalls;

        // laser prop fields
        this.laserLength = props.length;
        this.laserDuration = props.duration;
        this.laserInitialGrow = props.spawnAnimation;

        // bullet mods
        this.modArr = mods;
    }

    clone() {
        let clonedModArr = [];
        for (let i = 0; i < this.modArr.length; i++) {
            let mod = this.modArr[i];
            let clonedMod = {};
            let keys = Object.keys(mod);
            for (let i = 0; i < keys.length; i++) {
                let key = keys[i];
                let item = mod[key];
                let clonedItem;
                switch (typeof item) {
                    case "object":
                        if (item == null) { // no constructor
                            clonedItem = null;
                        } else if (item.constructor.name === "MBullet") {
                            // if there is circular callback, program will die. Hopefully this never happens :)
                            clonedItem = item.clone();
                        } else {
                            clonedItem = item; // no deep copy
                        }
                    default: // primative, functions, and everything else
                        clonedItem = item; 
                }
                clonedMod[key] = clonedItem;
            }
            clonedModArr.push(clonedMod)
            // clonedModArr.push(deepClone(this.modArr[i]));
        }

        let clonedProps = {};
        clonedProps.dir = this.dir;
        clonedProps.pos = [this.pos[0], this.pos[1]];
        clonedProps.damage = this.damage;
        clonedProps.color = [this.rgbArr[0], this.rgbArr[1], this.rgbArr[2]];
        clonedProps.size = this.size;
        clonedProps.groupId = this.groupId;
        clonedProps.indicator = this.indicator;
        clonedProps.alpha = this.alpha;
        if (!this.laser) {
            clonedProps.type = this.type;
            clonedProps.speed = this.speed;
            clonedProps.destroyable = this.destroyable;
            clonedProps.ignoreWalls = this.ignoreWalls;
            clonedProps.shadow = this.shadow;
            clonedProps.height = this.height;
        } else {
            clonedProps.length = this.laserLength;
            clonedProps.duration = this.laserDuration;
            clonedProps.spawnAnimation = this.laserInitialGrow;
        }

        return new MBullet(this.laser, clonedProps, clonedModArr)
    }

    static types = {
        orb: "orb",
        rice: "rice",
        ball: "ball",
        bubble: "bubble",
        star: "star"
    }
}

class PBullet {
    constructor(pos, props) {

    }
}

function moveBullets() {
    // move enemy bullets
    for (let i = 0; i < MBullet.bArr.length; i++) {
        let b = MBullet.bArr[i];
        if (b.alive) {
            b.aliveTime ++
            var distance = 0
            var defaultDir = true
            if (b.type === "laser") {
                if (b.indicator === false) {
                    var bulletRad = b.size * hitboxScaleFromType(b.type) * 10
                    var coordChange = ce.move([0, 0], b.dir, 1)
                    var slope = coordChange[1]/coordChange[0]
                    // v = vector from laser start to player pos
                    var v = [Player.pos[0] - b.pos[0], Player.pos[1] - b.pos[1]]
                    // dotProduct = dot product of coordChange and v
                    var dotProduct = v[0]*coordChange[0] + v[1]*coordChange[1]
                    // mag = magnitude of coordChange
                    var mag = Math.sqrt(coordChange[0]**2+coordChange[1]**2)
                    // mag2 = magnitude of v
                    var mag2 = Math.sqrt(v[0]**2 + v[1] ** 2)
                    // comp = scalar projection from v onto coordChange of the laser
                    var comp = dotProduct/mag
                    var distance = Math.sqrt(mag2**2 - comp**2)
                }

                // apply move effects

                for (let j = 0; j < b.modArr.length; j++) {
                    switch(b.modArr[j].type) {
                        case "laserGrow":
                            b.laserLength += b.modArr[j][1]
                            if (typeof(b.modArr[j][2]) === "number") {
                                if (Math.sign(b.modArr[j][1])*b.laserLength > Math.sign(b.modArr[j][1])*b.modArr[j][2]) {
                                    b.laserLength = b.modArr[j][2]
                                }
                            }
                            if (typeof(b.modArr[j][3]) === "number") {
                                b.modArr[j][1] += b.modArr[j][3]
                            }
                            if (typeof(b.modArr[j][4]) === "number") {
                                if (Math.sign(b.modArr[j][3])*b.modArr[j][1] > Math.sign(b.modArr[j][3])*b.modArr[j][4]) {
                                    b.modArr[j][1] = b.modArr[j][4]
                                }
                            }
                            break;
                        case "rot":
                            b.dir += b.modArr[j][1]
                            b.modArr[j][1] += b.modArr[j][2]
                            if (typeof(b.modArr[j][3]) === "number") {
                                if (Math.sign(b.modArr[j][2])*b.modArr[j][1] > Math.sign(b.modArr[j][2])*b.modArr[j][3]) {
                                    b.modArr[j][1] = b.modArr[j][3]
                                }
                            }
                            break;
                    }
                }
            } else {
                var bulletRad = hitboxScaleFromType(b.type)*10*b.size
                // test for special move types
                var standardMove = true
                var edgeDeletionType = "standard"
                var rotIndex = 0
                for (let j = 0; j < b.modArr.length; j++) {
                    let mod = b.modArr[j];
                    if (mod.type === "rot") {
                        let rotIndex = j;
                        b.rotDir += mod.rotSpeed;
                        mod.rotSpeed += mod.rotAccel;
                        if (typeof(mod.rotSpeedCap) === "number") {
                            if (Math.sign(mod.rotAccel)*mod.rotSpeed > Math.sign(mod.rotAccel)*mod.rotSpeedCap) {
                                mod.rotSpeed = mod.rotSpeedCap;
                            }
                        }
                        standardMove = false
                        edgeDeletionType = "rot"
                    }
                }
                if (standardMove)  {
                    b.pos = ce.move(b.pos, b.dir, b.speed)
                } else {
                    for (let j = 0; j < b.modArr.length; j++) {
                        let mod = b.modArr[j];
                        if (mod.type === "rot") {
                            // rotation move
                            mod.distance += b.speed
                            var oldPrevPos = b.rotPrevPos
                            b.rotPrevPos = [b.pos[0],b.pos[1]]
                            var prevPos = b.rotPrevPos
                            b.pos = ce.move(b.initialPos, b.rotDir, mod.distance)
                            if (mod.tidalLocked) {
                                b.dir = b.rotDir
                            } else {
                                b.dir = ce.dirToTarget(oldPrevPos, b.pos)
                            }
                        }
                    }
                }
                // post move effects
                for (let j = 0; j < b.modArr.length; j++) {
                    let mod = b.modArr[j];
                    switch(mod.type) {
                        case "spin":
                            if (!(typeof(mod.dir) === "number")) {
                                mod.dir = b.initialDir
                            }
                            b.renderDir = mod.dir;
                            defaultDir = false
                            mod.dir += mod.amount;
                            break;
                    }
                }
            }
            // shared post move effects
            for (let j = 0; j < b.modArr.length; j++) {
                let mod = b.modArr[j];
                switch(mod.type) {
                    case "itvFunct":
                        if (mod.repDelay*mod.runCount+mod.initDelay <= b.aliveTime) {
                            mod.funct(b, mod.runCount);
                            mod.runCount++;
                        }
                        break;
                }
            }
            if (defaultDir) {
                b.renderDir = b.dir
            }
            if (!b.indicator && b.alive) {
                if (b.type != "laser") {
                    if (b.destroyable) {
                        // yyOrb proj hitdetection
                        for (let i = 0; i < PlayerProj.projArr.length; i++) {
                            let proj = PlayerProj.projArr[i];
                            let distanceSqd = ce.distance(b.pos, ce.flipY(proj.pos), false)
                            if (b.aliveTime > 5 && distanceSqd < (bulletRad*0.75 + ((proj.groundTime > 0)? 150 : 30))**2) {
                                Sound.sounds.orbAbsorb.play(b.pos);
                                b.alive = false;
                            }
                        }

                        // wall hit detection (does not run every frame)
                        if (!b.ignoreWalls) {
                            let interval;
                            let distSqd = ce.distance(b.pos, Player.pos, false);
                            if (b.aliveTime <= 10 || distSqd < 500**2) {
                                interval = 1;
                            } else if (distSqd < 2000**2) {
                                interval = 3;
                            } else {
                                interval = 5;
                            }
                            if (b.aliveTime > 10 && b.speed <= 0.5) {
                                interval = 30;
                            }
                            if (b.aliveTime % interval === 0) {
                                if (MapObject.collision(new HitCircle(b.pos, bulletRad*0.75, false, true), [Player.hc.id], ["enemy", "river"])) {
                                    b.alive = false;
                                }
                            }
                        }
                    
                        // check once every distance of 20 + bullet size * 2 NOT NEEDED ANYMORE BECAUSE BVH
                        /*
                        let checkInterval = Math.floor((2*bulletRad*0.75+20)/Math.abs(b.speed))
                        if (checkInterval > 15) checkInterval = 15;
                        if (b.timeSinceLastCheck > checkInterval) {
                        b.timeSinceLastCheck = 0;
                            let moveCol = MapObject.moveCollision(b.pos, new HitCircle(b.pos, bulletRad*0.75, false, true), [Player.hc.id], true)
                            if (moveCol.collided) {
                                b.alive = false;
                            }
                        } else {
                            b.timeSinceLastCheck++;
                        }
                        */
                    }
                }

                // player hitdetection
                if (b.type === "laser") {
                    // withinLength = if the closest distance point on the line to the player is within the length of the laser
                    let distance;
                    var withinLength = true
                    var length = (b.laserLength === null) ? 100000 : b.laserLength;
                    if (length === 0) {
                        withinLength = false
                    }
                    if (Math.sign(comp)*Math.sign(length) === -1) {
                        withinLength = false
                    }
                    if (Math.sign(length) * comp > Math.sign(length) * length) {
                        withinLength = false
                    }
                    if (!withinLength) {
                        distance = null
                    }
                    var radialDistance = ce.distance(Player.pos, b.pos)
                    if (!(typeof(distance) === "number") || radialDistance < distance) {
                        distance = radialDistance
                    }
                    if (distance < bulletRad*1 + pHitboxRadius + 20) {
                        if ((!b.laserInitialGrow || b.aliveTime > 10) && distance < bulletRad*0.75 + pHitboxRadius) {
                            if (b.destroyable) {
                                b.alive = false
                            }
                            if (playerInvincibleTime === 0) {
                                playerAlive = false
                            }
                        } else if (playerInvincibleTime === 0 && b.laserGrazeDelay === 0) {
                            graze();
                            // Sound.sounds.graze.play()
                            b.laserGrazeDelay = 6
                        } if (playerInvincibleTime > 0) {
                            b.grazed = false
                        }
                    }
                    if (b.laserGrazeDelay > 0) {
                        b.laserGrazeDelay --
                    }
                } else {
                    // normal bullet hit detection
                    let distanceSqd = ce.distance(Player.pos, b.pos, false)
                    if (b.aliveTime > 5 && distanceSqd < (bulletRad*0.75 + pHitboxRadius)**2) {
                        if (b.destroyable) {
                            b.alive = false
                        }
                        // damage player here
                        if (Dialog.activeDialog == null) {
                            Player.health -= b.damage;
                            Player.regenPause += b.damage;
                        }
                        Sound.sounds.hit.playDir(ce.dirToTarget(Player.pos, b.pos));
                    }
                }
            }
            if (b.type == "laser" && typeof(b.laserDuration) === "number" && b.laserDuration <= b.aliveTime) {
                b.alive = false
            }
        } else {
            b.deathFade += 1
            if (b.deathFade >= 10) {
                MBullet.bArr[i].pos = null;
                MBullet.bArr.splice(i, 1)
                i--
            }
        }
        // move effects that run reguardless of alive or dead
        for (let j = 0; j < b.modArr.length; j++) {
            switch(b.modArr[j][0]) {
                case "colorCycle":
                    if (!(typeof(b.modArr[j][2]) === "number")) {
                        b.modArr[j][2] = Math.random()*Math.PI*2
                    }
                    var colorCycle = b.modArr[j][2]
                    b.modArr[j][2] += b.modArr[j][1]
                    b.rgbArr = [Math.sin(colorCycle) * 127 + 128, Math.sin(colorCycle + Math.PI*2/3) * 127 + 128, Math.sin(colorCycle + Math.PI*4/3) * 127 + 128]
                    break;
            }
        }
    }
}

function drawBulletShadows() {
    // draw shadows
    c.resetTrans();
    Draw.camCanvasOffset();
    c.fillStyle = "rgb(0,0,0)";
    MBullet.bArr.forEach(function(item, index) {
        if (item.type === "laser") return;
        if (!item.shadow) return;
        var scale = item.size
        var hitboxScale = hitboxScaleFromType(item.type)

        // detect if off screen
        if (Math.abs(item.pos[0]-Player.camPos[0]) > ce.screenDim[0]/2/zoom + hitboxScale*scale*20|| Math.abs(item.pos[1]-Player.camPos[1]) > ce.screenDim[1]/2/zoom + hitboxScale*scale*20) return;

        c.globalAlpha = 0.5*item.alpha;
        if (item.alive) {
            if (item.aliveTime < 5) {
                scale *= (1+(5-item.aliveTime)/5*2)
                c.globalAlpha *= (1-(4-item.aliveTime)/5)
            }
        } else {
            if (item.deathFade > 0) {
                scale *= (10-item.deathFade)/10
            }
        }

        // draw bullet shadow
        c.fillStyle = "rgb(0,0,0)";
        c.fillCircle(item.pos[0], -item.pos[1], scale*hitboxScale*10);
    })
}

function drawBullets(frontOfPlayer) {
    /*
    c.resetTrans();
    Draw.camCanvasOffset();
    MBullet.bArr.forEach(drawLaserIndicator);
    c.resetTrans();
    Draw.camCanvasOffset();
    MBullet.bArr.forEach(drawLaser);
    */
    if (!frontOfPlayer) {
        // draw shadows
        drawBulletShadows();
    }
    c.resetTrans();
    Draw.camCanvasOffset();
    MBullet.bArr.forEach(function(item, index) {
        if (item.pos[1] > Player.pos[1] && frontOfPlayer) {
            return;
        }
        if (item.pos[1] <= Player.pos[1] && !frontOfPlayer) {
            return;
        }
        drawBullet(item, index)
    });
    c.globalAlpha = 1;
}

// gets the scale of a bullet relative to other bullets
function hitboxScaleFromType(bulletType) {
    switch(bulletType) {
        case "laser":
            return 2
            break;
        case "rice":
            return 0.75
            break;
        case "ball":
            return 1.5
            break;
        case "bubble":
            return 2
            break;
        default:
            return 1
            break;
    }
}

// WIP
/*
function drawLaserIndicator(item, index) {
    if (item.type === "laser" && item.indicator) {
        var scale = item.size
        var color = item.rgbArr
        var hitboxScale = hitboxScaleFromType(item.type)
        c.globalAlpha = item.alpha
        if (item.alive && item.laserInitialGrow) {
            if (item.aliveTime < 10) {
                scale *= (item.aliveTime)/10
            }
        } else {
            if (item.deathFade > 0) {
                scale *= (10-item.deathFade)/10
            }
        }
        var coordChange = ce.move([0, 0], item.dir, 1)
        var slope = coordChange[1]/coordChange[0]
        var length = item.laserLength
        if (!(typeof(length) === "number")) {
            length = Math.sqrt(ce.screenDim[0]**2 + ce.screenDim[1]**2)
        }
        var initialWidth = hitboxScale * 10 * (1+(Math.sin(item.aliveTime*Math.PI/5)*0.05)) * 2 * scale
        var startPos = [ce.screenDim[0]/2 + item.pos[0], ce.screenDim[1]/2 - item.pos[1]]
        var endPos = [ce.screenDim[0]/2 + (item.pos[0] + coordChange[0]*length), ce.screenDim[1]/2 - (item.pos[1] + coordChange[1]*length)]
        var darkness = (Math.sin(item.aliveTime/2)+1)/4+0.5
        var fill = `rgb(${color[0]*darkness}, ${color[1]*darkness}, ${color[2]*darkness}`
        var width = initialWidth
        c.lineWidth = width
        c.strokeStyle = fill
        c.fillStyle = fill
        c.beginPath()
        c.moveTo(startPos[0], startPos[1])
        c.lineTo(endPos[0], endPos[1])
        c.stroke()
        c.beginPath()
        c.moveTo(startPos[0], startPos[1])
        c.arc(ce.screenDim[0]/2 + item.pos[0], ce.screenDim[1]/2 - item.pos[1], width/2, -item.dir*Math.PI/180 - Math.PI*0.5, -item.dir*Math.PI/180 + Math.PI*0.5, true)
        c.fill()
    }
}

// WIP
function drawLaser(item, index) {
    if (item.type === "laser" && !(item.indicator)) {
        var scale = item.size
        var color = item.rgbArr
        var hitboxScale = hitboxScaleFromType(item.type)
        c.globalAlpha = item.alpha
        if (item.alive && item.laserInitialGrow) {
            if (item.aliveTime < 10) {
                scale *= (item.aliveTime)/10
            }
        } else {
            if (item.deathFade > 0) {
                scale *= (10-item.deathFade)/10
            }
        }
        var coordChange = ce.move([0, 0], item.dir, 1)
        var slope = coordChange[1]/coordChange[0]
        var length = item.laserLength
        if (!(typeof(length) === "number")) {
            length = Math.sqrt(ce.screenDim[0]**2 + ce.screenDim[1]**2)
        }
        var width = hitboxScale * 10 * (1+(Math.sin(item.aliveTime*Math.PI/5)*0.05)) * 2 * scale
        var startPos = [ce.screenDim[0]/2 + item.pos[0], ce.screenDim[1]/2 - item.pos[1]]
        var startPos = ce.move(startPos,item.dir,0.5)
        var endPos = [ce.screenDim[0]/2 + (item.pos[0] + coordChange[0]*length), ce.screenDim[1]/2 - (item.pos[1] + coordChange[1]*length)]
        
        var pos = [ce.screenDim[0]/2 + item.pos[0], ce.screenDim[1]/2 - item.pos[1]];
        var posA = ce.move(pos,-item.dir+90,width/2*1.5);
        var posB = ce.move(pos,-item.dir-90,width/2*1.5);
        var grd = c.createRadialGradient(pos[0],pos[1],0,pos[0],pos[1],width*1.5/2);
        grd.addColorStop(0,ce.colorArrToString(ce.colorLighten(color,0.9)));
        grd.addColorStop(1/1.5,ce.colorArrToString(color));
        grd.addColorStop(1,`rgba(${color[0]},${color[1]},${color[2]},0)`);
        c.fillStyle = grd;
        c.beginPath();
        c.arc(ce.screenDim[0]/2 + item.pos[0], ce.screenDim[1]/2 - item.pos[1], width/2*1.5, -item.dir*Math.PI/180 - Math.PI*0.5, -item.dir*Math.PI/180 + Math.PI*0.5, true);
        c.fill();
        //c.fillCircle(pos[0],pos[1],width*)
        var grd = c.createLinearGradient(posA[0],posA[1],posB[0],posB[1]);
        grd.addColorStop(0,`rgba(${color[0]},${color[1]},${color[2]},0)`);
        grd.addColorStop(0.25/1.5,ce.colorArrToString(color));
        grd.addColorStop(0.5,ce.colorArrToString(ce.colorLighten(color,0.9)));
        grd.addColorStop(1.25/1.5,ce.colorArrToString(color));
        grd.addColorStop(1,`rgba(${color[0]},${color[1]},${color[2]},0)`);
        c.strokeStyle = grd;
        c.lineWidth = width*1.5
        c.beginPath()
        c.moveTo(startPos[0], startPos[1])
        c.lineTo(endPos[0], endPos[1])
        c.stroke();
    }
}
*/

function drawBullet(item, index) {
    if (item.type === "laser") return;
    var scale = item.size
    var color = item.rgbArr
    var hitboxScale = hitboxScaleFromType(item.type)
    c.globalAlpha = item.alpha

    // detect if off screen
    if (Math.abs(item.pos[0]-Player.camPos[0]) > ce.screenDim[0]/2/zoom + hitboxScale*scale*20|| Math.abs(item.pos[1]-Player.camPos[1]) > ce.screenDim[1]/2/zoom + hitboxScale*scale*20 + item.height) return;

    if (item.alive) {
        if (item.aliveTime < 5) {
            scale *= (1+(5-item.aliveTime)/5*2)
            c.globalAlpha *= (1-(4-item.aliveTime)/5)
        }
    } else {
        if (item.deathFade > 0) {
            scale *= (10-item.deathFade)/10
        }
    }
    
    /*
    if (item.grazed) {
        color = [128+color[0]/255*127, 128+color[1]/255*127, 128+color[2]/255*127]
    }
    */

    // draw bullet
    const height = (debug)? 0 : item.height;
    c.save();
    c.transformCanvas(scale,-item.renderDir,item.pos[0],-item.pos[1]-height+((item.deathFade/10)**2)*50)
    if (item.size > 0) {
        switch(item.type) {
            case "orb":
                c.fillStyle = `rgb(${color[0]}, ${color[1]}, ${color[2]})`
                c.fillCircle(0, 0, 10*hitboxScale)
                c.fillStyle = `rgb(${200+color[0]/255*55}, ${200+color[1]/255*55}, ${200+color[2]/255*55})`
                c.fillCircle(0, 0, 7.5*hitboxScale)
                break;
            case "rice":
                c.fillStyle = `rgb(${color[0]}, ${color[1]}, ${color[2]})`
                c.fillEllipse(0, 0, 0, hitboxScale*7, hitboxScale*13)
                c.fillStyle = `rgb(${200+color[0]/255*55}, ${200+color[1]/255*55}, ${200+color[2]/255*55})`
                c.fillEllipse(0, 0, 0, hitboxScale*5.25, hitboxScale*9.75)
                break;
            case "ball":
                var darkColor = `rgb(${color[0]}, ${color[1]}, ${color[2]})`
                var lightColor = `rgb(${200+color[0]/255*55}, ${200+color[1]/255*55}, ${200+color[2]/255*55})`
                var transColor = `rgb(${color[0]}, ${color[1]}, ${color[2]}, 0)`
                var grd = c.createRadialGradient(0, 0, 0, 0, 0, hitboxScale*10)
                grd.addColorStop(0.2, lightColor)
                grd.addColorStop(0.8, darkColor)
                grd.addColorStop(1, transColor)
                c.fillStyle = grd
                c.fillCircle(0, 0, hitboxScale*10)
                break;
            case "bubble":
                var mainColor = `rgb(${color[0]}, ${color[1]}, ${color[2]})`
                var lightColor = "rgb(255,255,255)"
                c.globalAlpha /= 2
                c.fillStyle = mainColor
                c.fillCircle(0, 0, hitboxScale*10)
                c.globalAlpha *= 2
                c.beginPath()
                c.circle(0, 0, hitboxScale*15)
                c.lineWidth = hitboxScale*10
                c.strokeStyle = lightColor
                c.stroke()
                c.globalAlpha /= 2
                c.beginPath()
                c.circle(0, 0, hitboxScale*10)
                c.lineWidth = hitboxScale*5
                c.strokeStyle = mainColor
                c.stroke()
                c.globalAlpha *= 2
                break;
            case "star":
                c.fillStyle = `rgb(${color[0]}, ${color[1]}, ${color[2]})`
                c.fillStar(0, 0, hitboxScale*12, 0, 5, 0.6, 1)
                c.fillStyle = `rgb(${200+color[0]/255*55}, ${200+color[1]/255*55}, ${200+color[2]/255*55})`
                c.fillStar(0, 0, hitboxScale*8, 0, 5, 0.6)
                break;
        }
    }
    c.globalAlpha = 1
    c.restore();
}

function spawnBullet(bullet) {
    MBullet.bArr.push(bullet.clone())
}

function spawnRing(mainBullet, amount) {
    for (let i = 0; i < amount; i++) {
        MBullet.bArr.push(mainBullet.clone())
        mainBullet.dir += 360/amount
        mainBullet.renderDir = mainBullet.dir
        mainBullet.rotDir = mainBullet.dir
    }
}

// adds mod to a bullet
function addMod(index, modList) {
    MBullet.bArr[index].modArr = MBullet.bArr[index].modArr.concat(modList)
}

// finds a specific mod in bullet's modArr and returns the ID of the mod
function findModIndex(bulletIndex, modType) {
    let modArr = bulletArr[bulletIndex].modArr
    let i = 0
    while (i<modArr.length && !(modArr[i][0] === modType)) {
        i++
    }
    if (i < modArr.length) {
        return i
    } else {
        return null
    }
}

// finds a specific mod in bullet's modArr and returns the found array
function findMod(bulletIndex, modType) {
    let modArr = bulletArr[bulletIndex].modArr
    let i = findModIndex(bulletIndex, modType)
    if (typeof(i) === "number") {
        return modArr[i]
    } else {
        return null
    }
}

// changes the value of part of a specific mod, if typeIndex is null, replaces the entire mod section
function changeMod(bulletIndex, modType, typeIndex, newValue, isAdd=false) {
    let i = findModIndex(bulletIndex, modType)
    if (typeof(i) === "number") {
        if (typeIndex === null) {
            bulletArr[bulletIndex].modArr[i] = newValue
        } else if (isAdd) {
            bulletArr[bulletIndex].modArr[i][typeIndex] += newValue
        } else {
            bulletArr[bulletIndex].modArr[i][typeIndex] = newValue
        }
    }
}

// deletes a specific mod from a bullet
function delMod(bulletIndex, type) {
    let i = findModIndex(bulletIndex, type)
    if (typeof(i) === "number") {
        bulletArr[bulletIndex].modArr.splice(i, 1)
    }
}