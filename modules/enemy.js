import {Collision, HitBox, HitCircle} from './collisions.js';
import {MBullet, spawnRing, spawnBullet} from "./bullets.js";
import * as mod from "./bulletMods.js";
import {MainLoop, Draw} from "./main.js";
import { Graphic, MapObject } from './mapObj.js';
import {Player, PlayerProj} from "./player.js"
export {Enemy};
import * as ce from './canvasExtension.js';
import {RenderObj} from "./renderOrder.js";
import {Sound} from "./audio.js";

const canvas = ce.canvas
const c = canvas.getContext("2d", {alpha: false})
export let shot;

export function initShotSounds() {
    shot = {
        tap: Sound.sounds.eShotTap,
        bump: Sound.sounds.eShotBump,
        slam: Sound.sounds.eShotSlam,
        blast: Sound.sounds.eShotBlast,
    }
    Enemy.s = shot;
}

class Enemy {
    static s; // holds sounds of enemies, set to shot
    static eDict = {}; // dict of all enemies
    static nextId = 0; // id given to next enemy spawned
    id = 0; // id of enemy (in eDict)
    cycles = 0; // ticks since enemy spawned
    pos = [0,0]; // position of enemy
    prevPos = [0,0]; // prev position of enemy every cycle
    velo = [0,0]; // velocity of enemy
    #health = 0; // health of enemy
    maxHealth = 0; // max health of enemy
    colArr; // holds collision objects of enemy
    graphicDict; // holds graphic objects of enemy
    moveFunct; // function that runs every frame which determines enemy movement
    bulletFunct; // function that runs after moveFunct every frame that determines bullet spawn patterns
    activeGraphicId = null; // current active graphic id
    orbAOEImmunity = false; // immune to orb AOE damage
    hideHP = false; // hide health bar
    constructor(pos, health, colArr = [], graphicDict = null, moveFunct = null, bulletFunct = null, initGraphicId = null, template = false, customId = null, orbAOEImmunity = false, hideHP = false, hbHeight = 150) {
        if (customId != null || !template) {
            if (customId == null) {
                this.id = Enemy.nextId;
                Enemy.nextId++;
            } else {
                this.id = customId;
            }
            if (!template)
                Enemy.eDict[this.id] = this;
        }
        this.hbHeight = hbHeight;
        this.velo = [0,0];
        this.cloneData = {
            initGraphicId: initGraphicId
        }
        this.cycles = 0;
        this.dead = false;
        this.deadTime = 0;
        this.pos = pos;
        this.maxHealth = health;
        this.health = health;
        this.colArr = colArr;
        this.orbAOEImmunity = orbAOEImmunity;
        this.hideHP = hideHP;
        for (let index in this.colArr) { // offset hitboxes relative to enemy pos
            let item = this.colArr[index];
            item.basePos = [item.pos[0], item.pos[1]]
            item.enemy = true;
        }
        this.updateHitboxPos();
        this.activeGraphic = initGraphicId;
        if (graphicDict == null) {
            this.graphicDict = {};
        } else {
            this.graphicDict = graphicDict;
        }
        if (moveFunct == null) {
            this.moveFunct = function(self, cycles) {}
        } else {
            this.moveFunct = moveFunct;
        }
        if (bulletFunct == null) {
            this.bulletFunct = function(self, cycles) {}
        } else {
            this.bulletFunct = bulletFunct;
        }
    }

    get health() {
        return this.#health;
    }
    
    set health(hp) {
        this.#health = hp;
        if (this.#health <= 0) {
            this.#health = 0;
            this.dead = true;
        }
        if (this.#health > this.maxHealth) {
            this.#health = this.maxHealth;
        }
    }

    remove() {
        // remove collision objects
        for (let i in this.colArr) {
            this.colArr[i].remove();
        }
        // delete from static dict
        delete Enemy.eDict[this.id];
    }

    updatePos(hc) { // runs enemy movement collision and updates prevPos
        // see if enemy moved a significant distance
        if (ce.distance(this.pos,this.prevPos,false) < 1)
            return;
        
        // run move collision and update prevPos
        let moveCol = MapObject.moveCollision(this.pos, hc, []);
        if (moveCol.collided) {
            let oldPos = [this.pos[0], this.pos[1]];
            this.pos = moveCol.pos;
            this.velo = Collision.bounce(ce.dirToTarget(oldPos, this.pos), this.velo, 0.5);
        }
        this.prevPos = [this.pos[0], this.pos[1]];
    }

    updateHitboxPos() {
        for (let index in this.colArr) {
            let item = this.colArr[index];
            for (let i = 0; i < 2; i++) {
                item.pos[i] = item.basePos[i] + this.pos[i];
            }
        }
    }

    clone(pos=null, template=false, customId=null) {
        let clonedColArr = [];
        for (let i in this.colArr) {
            clonedColArr.push(this.colArr[i].clone(template));
            clonedColArr[i].pos = [this.colArr[i].basePos[0], this.colArr[i].basePos[1]];
        }
        let clonedGraphicDict = {};
        for (let key in this.graphicDict) {
            clonedGraphicDict[key] = this.graphicDict[key].clone();
        }
        if (pos == null) pos = this.pos;
        let e = new Enemy([pos[0],pos[1]], this.maxHealth, clonedColArr, clonedGraphicDict, this.moveFunct, this.bulletFunct, this.cloneData.initGraphicId, template, customId, this.orbAOEImmunity, this.hideHP, this.hbHeight);
        return e;
    }

    static enemyCalc() {
        for (let id in Enemy.eDict) {
            let e = Enemy.eDict[id];
            if (e.dead) {
                if (e.deadTime === 0) {
                    // remove collision objects
                    for (let i in e.colArr) {
                        e.colArr[i].remove();
                    }
                    e.colArr = [];
                }
                e.deadTime++;
                if (e.deadTime >= 30) {
                    e.remove();
                }
            } else {
                e.moveFunct(e, e.cycles);
                e.updateHitboxPos();
                e.bulletFunct(e, e.cycles);
            }
            if (e.cycles === 0) {
                e.cycles = 1+Math.floor(Math.random()*600)
            } else {
                e.cycles++;
            }
        }
    }

    draw() {
        if (this.activeGraphic == null || !(this.activeGraphic in this.graphicDict)) return;
        c.resetTrans();
        Draw.camCanvasOffset();
        let g = this.graphicDict[this.activeGraphic];
        let img = g.getImage();
        c.transformCanvas(g.scale, 0, this.pos[0] + g.offset[0]- img.height*g.scale/2, -this.pos[1] - img.height*g.scale - g.offset[1] - (this.deadTime/30)**2*150)
        if (this.deadTime > 0) {
            c.globalAlpha = 1-this.deadTime/30
        }
        c.drawImage(img, 0, 0)
    }

    /*
    ENEMY LIST:
    Neutral (Marksman) - shoots bullets repeatedly directly at player, pausing sometimes to reload
    HP - Medium
    Speed - Medium
    Damage - Medium
    AI - Keeps medium distance

    Agony (Shotgunner) - shoots a burst of slow, short-range, and inaccurate bullets every few seconds
    HP - High
    Speed - Slow when far away, fast when close
    Damage - High
    AI - Stays close and strafes

    Regret (Wizard) - summons bullets from the ground (warning indicators precede them) which burst after a short time (bullets cannot be blocked and are very short range)
    HP - Low
    Speed - High (cuz teleport)
    Damage - High
    AI - Teleports around when player gets too close

    Evil (Shaman) - Summons stationary orbs around the screen that shoot bullets towards the player and disappear after a set time
    HP - Medium
    Speed - Medium
    Damage - Medium
    AI - Walks around at random directions

    Sorrow (Trailblazer) - Shoots shots that spawn stationary orbs on its path which works to limit player movement
    HP - High
    Speed - Slow
    Damage - Low
    AI - Keeps high distance

    Rage (Chaser) - chases player and explodes into bullets when close (creeper)
    HP - Low
    Speed - Fast
    Damage - Low
    AI - Chases player straight on
    */

    static templateDict = {};
    static loadEnemies = function() {
        Enemy.templateDict = {
            neutralBas: new Enemy([0,0], 80, [
                // collision arr
                new HitCircle([0,0], 30, false, true)
            ], {
                // graphic dict
                still: new Graphic("spirit/neutral_bas", ["enemy"], ".png", 0.25)
            }, function(self, cycles) {
                // move funct
                let distSqd = ce.distance(Player.pos, self.pos, false);

                // cycle 0 stuff
                if (cycles === 0) {
                    self.randomOffset = Math.random()*Math.PI*2;
                }

                // velocity change
                if (distSqd <= 1500**2) {
                    self.velo = ce.move(self.velo, ce.dirToTarget(self.pos, Player.pos), (0.15+Math.sin(cycles*Math.PI*2/60+self.randomOffset)*0.2) * ((distSqd <= 500**2)? -1 : 1));
                }
                
                // movement
                for (let i = 0; i < 2; i++) {
                    self.pos[i] += self.velo[i];
                    self.velo[i] *= 0.96;
                }

                // collision detection
                self.updatePos(self.colArr[0]);

            }, function(self, cycles) {
                // bullet funct
                let distSqd = ce.distance(Player.pos, self.pos, false);
                let dirToPlayer = ce.dirToTarget(self.pos, Player.pos)
                if (distSqd <= 900**2 && cycles % 60 === 0) {
                    // ring of orbs
                    shot.bump.play(self.pos);
                    spawnRing(new MBullet(false, {
                        pos: self.pos,
                        type: MBullet.types.orb,
                        dir: null,
                        speed: 20,
                        damage: 10,
                        color: [0,255,255],
                        size: 2
                    }, [
                        mod.moveTimer(600),
                        mod.moveAccel(-0.5, 10)
                    ]), 8)
                }
                if (distSqd <= 1200**2 && cycles % 12 === 0 && cycles % 120 >= 60) {
                    // aimed rapid fire rice
                    shot.tap.play(self.pos);
                    spawnBullet(new MBullet(false, {
                        pos: self.pos,
                        type: MBullet.types.rice,
                        dir: dirToPlayer+(Math.random()-0.5)*30,
                        speed: 25,
                        damage: 10,
                        color: [0,0,255],
                        size: 1.5
                    }, [
                        mod.moveTimer(600),
                        mod.moveAccel(-0.5, 15)
                    ]))
                }
            }, "still", true),
            agonyBas: new Enemy([0,0], 100, [
                // collision arr
                new HitCircle([0,0], 30, false, true)
            ], {
                // graphic dict
                still: new Graphic("spirit/agony_bas", ["enemy"], ".png", 0.25)
            }, function(self, cycles) {
                // move funct

                // cycle 0 stuff
                if (cycles === 0) {
                    self.randomOffset = Math.random()*Math.PI*2;
                }

                if (cycles % 120 === 0) {
                    self.targetPos = ce.move(Player.pos, Math.random()*360, Math.random()*500)
                }
                let distSqd = ce.distance(self.targetPos, self.pos, false);

                // velocity change
                if (distSqd <= 1500**2) {
                    let accel = (0.1+Math.sin(cycles*Math.PI*2/60+self.randomOffset)*0.15);
                    self.velo = ce.move(self.velo, ce.dirToTarget(self.pos, self.targetPos), accel);
                }
                
                // movement
                for (let i = 0; i < 2; i++) {
                    self.pos[i] += self.velo[i];
                    self.velo[i] *= 0.96;
                }

                // collision detection
                self.updatePos(self.colArr[0]);
            }, function(self, cycles) {
                // bullet funct
                let distSqd = ce.distance(Player.pos, self.pos, false);
                let dirToPlayer = ce.dirToTarget(self.pos, self.targetPos)
                if (distSqd <= 800**2 && cycles % 60 === 0) {
                    shot.bump.play(self.pos);
                    // shotgun
                    for (let i = 0; i < 10; i++) {
                        let speed = 5+Math.random()*5
                        spawnBullet(new MBullet(false, {
                            pos: self.pos,
                            type: MBullet.types.ball,
                            speed: speed*3,
                            damage: 5,
                            size: 0.5+Math.random(),
                            color: [255,Math.random()*128,0],
                            dir: dirToPlayer + (Math.random()-0.5)*45
                        }, [
                            mod.moveTimer(180+Math.random()*60),
                            mod.moveAccel(-speed/10, speed)
                        ]))
                    }
                }
                if (distSqd <= 1200**2 && cycles % 12 === 0) {
                    shot.tap.play(self.pos, 0.1);
                    // random bullets
                    let speed = 2+Math.random()*3
                    spawnBullet(new MBullet(false, {
                        pos: self.pos,
                        type: MBullet.types.ball,
                        speed: speed*3,
                        damage: 5,
                        size: 0.5+Math.random(),
                        color: [255,0,0],
                        dir: null
                    }, [
                        mod.moveTimer(60+Math.random()*60),
                        mod.moveAccel(-speed/10, speed)
                    ]))
                }
            }, "still", true),
            regretBas: new Enemy([0,0], 70,[
                // collision arr
                new HitCircle([0,0], 30, false, true)
            ], {
                // graphic dict
                still: new Graphic("spirit/regret_bas", ["enemy"], ".png", 0.25)
            }, function(self, cycles) {
                // move funct

                // cycle 0 stuff
                if (cycles === 0) {
                    self.randomOffset = Math.random()*Math.PI*2;
                    self.tpCooldown = 0;
                }

                let distSqd = ce.distance(Player.pos, self.pos, false);
                if (distSqd > 1500**2) return;

                // teleport
                self.tpCooldown -= 1;
                if (self.tpCooldown < 0) self.tpCooldown = 0;
                if (distSqd <= 500**2 && self.tpCooldown === 0) {
                    let validLoc = false;
                    let tries = 0;
                    let targetPos;
                    while (!validLoc && tries < 10) {
                        tries++;
                        let targetDir = Math.random()*365;
                        let stepCap = Math.floor(Math.random()*20)+5;
                        let steps;
                        targetPos = [Player.pos[0], Player.pos[1]]
                        for (steps = 0; steps < stepCap; steps++) {
                            targetPos = ce.move(targetPos, targetDir, 50)
                            let moveCol = MapObject.moveCollision(targetPos, self.colArr[0], [Player.hc.id]);
                            if (!moveCol.notCollided) {
                                break;
                            }
                        }
                        if (steps >= 5) {
                            validLoc = true;
                        }
                    }
                    if (validLoc) {
                        self.tpCooldown += 120
                        // spawn bullets along line of teleport
                        shot.slam.play(self.pos);
                        let steps = Math.ceil(ce.distance(self.pos, targetPos)/150)
                        for (let i = 0; i < steps; i++) {
                            let pos = [self.pos[0], self.pos[1]];
                            for (let j = 0; j < 2; j++) {
                                pos[j] += i/steps * (targetPos[j] - pos[j])
                            }
                            spawnBullet(new MBullet(false, {
                                pos: pos,
                                indicator: true,
                                type: MBullet.types.bubble,
                                dir: null,
                                speed: 0,
                                damage: 5,
                                color: [128,0,255],
                                size: 0.2
                            }, [
                                mod.moveIntervalFunction(function(self) {
                                    self.size += (1-self.size)*0.02;
                                }, 1, 0),
                                mod.moveReplaceBulletTimer(60+i*2, new MBullet(false, {
                                    pos: [0,0],
                                    type: MBullet.types.rice,
                                    dir: null,
                                    speed: 10,
                                    damage: 10,
                                    color: [255,0,255],
                                    size: 2
                                }, [
                                    mod.moveTimer(120),
                                    mod.moveAccel(-0.1, 5)
                                ]), 5, true, true, shot.tap)
                            ]))
                        }
                        self.pos = targetPos;
                    } else {
                        self.tpCooldown += 30;
                    }
                }
                
                // movement
                for (let i = 0; i < 2; i++) {
                    self.pos[i] += self.velo[i];
                    self.velo[i] *= 0.95;
                }

                // collision detection
                self.updatePos(self.colArr[0]);
            }, function(self, cycles) {
                // bullet funct
                let distSqd = ce.distance(Player.pos, self.pos, false);
                let dirToPlayer = ce.dirToTarget(self.pos, Player.pos)
                if (distSqd <= 1200**2 && cycles % 120 === 0) {
                    // delayed exploding multi rotating bullet ring
                    shot.bump.play(self.pos);
                    let targetPos = ce.move(Player.pos, Math.random()*360, Math.random()*200);
                    let dirToTarget = ce.dirToTarget(self.pos, targetPos);
                    let distToTarget = ce.distance(self.pos, targetPos, false);
                    let rot = (Math.random() <= 0.5)? -2 : 2;
                    spawnBullet(new MBullet(false, {
                        pos: self.pos,
                        indicator: true,
                        type: MBullet.types.bubble,
                        dir: dirToTarget,
                        speed: Math.sqrt(distToTarget)/60,
                        color: [128,0,255],
                        size: 0.2,
                    }, [
                        mod.moveIntervalFunction(function(self) {
                            self.speed = 0;
                        }, null, 60),
                        mod.moveIntervalFunction(function(self) {
                            self.size += (3-self.size)*0.02;
                        }, 1, 0),
                        mod.moveReplaceBulletTimer(120, new MBullet(false, {
                            pos: [0,0],
                            type: MBullet.types.ball,
                            dir: null,
                            speed: 0,
                            damage: 10,
                            destroyable: false,
                            color: [128,0,255],
                            size: 10
                        }, [
                            mod.moveSpawnBulletTimer(5, 0, new MBullet(false, {
                                pos: [0,0],
                                type: MBullet.types.rice,
                                dir: null,
                                speed: 15,
                                damage: 8,
                                color: [255,0,255],
                                size: 2
                            }, [
                                mod.moveTimer(180),
                                mod.moveAccel(-0.1, 10),
                                mod.moveRot(rot, -rot/120, rot/5),
                            ]), 10, true, true, shot.bump),
                            mod.moveTimer(15)
                        ]), 1, true, true, shot.slam)
                    ]))
                }
            }, "still", true),
            evilBas: new Enemy([0,0], 120, [
                // collision arr
                new HitCircle([0,0], 30, false, true)
            ], {
                // graphic dict
                still: new Graphic("spirit/evil_bas", ["enemy"], ".png", 0.25)
            }, function(self, cycles) {
                // move funct
                let prevPos = [self.pos[0], self.pos[1]];
                let distSqd = ce.distance(Player.pos, self.pos, false);

                // cycle 0 stuff
                if (cycles === 0) {
                    self.randomOffset = Math.random()*Math.PI*2;
                }

                // velocity change
                if (distSqd <= 1500**2) {
                    self.velo = ce.move(self.velo, ce.dirToTarget(self.pos, Player.pos), (0.15+Math.sin(cycles*Math.PI*2/60+self.randomOffset)*0.2) * ((distSqd <= 800**2)? -1 : 0.5));
                }
                
                // movement
                for (let i = 0; i < 2; i++) {
                    self.pos[i] += self.velo[i];
                    self.velo[i] *= 0.98;
                }

                // collision detection
                self.updatePos(self.colArr[0]);
            }, function(self, cycles) {
                // bullet funct
                let distSqd = ce.distance(Player.pos, self.pos, false);
                let dirToPlayer = ce.dirToTarget(self.pos, Player.pos)
                if (distSqd <= 1200**2 && cycles % 90 === 0) {
                    // slow moving bullet turrets
                    shot.slam.play(self.pos);
                    let targetPos = ce.move(Player.pos, Math.random()*360, Math.random()*200);
                    let dirToTarget = ce.dirToTarget(self.pos, targetPos);
                    let distToTarget = ce.distance(self.pos, targetPos, false);
                    spawnBullet(new MBullet(false, {
                        pos: self.pos,
                        type: MBullet.types.bubble,
                        dir: dirToTarget,
                        color: [0,0,0],
                        speed: 10,
                        damage: 15,
                        size: 1,
                    }, [
                        mod.moveAccel(-0.2, 5),
                        mod.moveIntervalFunction(function(self) {
                            if (ce.distance(self.pos, Player.pos, false) > 1000**2) return;
                            shot.tap.play(self.pos);
                            for (let i = 0; i < 3; i++) {
                                spawnBullet(new MBullet(false, {
                                    pos: [self.pos[0],self.pos[1]],
                                    type: MBullet.types.rice,
                                    dir: ce.dirToTarget(self.pos,Player.pos),
                                    speed: 15+i*3,
                                    damage: 8,
                                    color: [255,0,0],
                                    size: 2
                                }, [
                                    mod.moveTimer(120),
                                    mod.moveAccel(-0.1, 10+i*2)
                                ]))
                            }
                        }, 60, 60),
                        mod.moveReplaceBulletTimer(300, new MBullet(false, {
                            pos: [0,0],
                            type: MBullet.types.orb,
                            dir: null,
                            speed: 10,
                            damage: 10,
                            color: [255,0,0],
                            size: 2
                        }, [
                            mod.moveTimer(120),
                            mod.moveAccel(-0.1, 5)
                        ]), 10, true, true, shot.bump)
                    ]))
                }
            }, "still", true),
            sorrowBas: new Enemy([0,0], 140, [
                // collision arr
                new HitCircle([0,0], 30, false, true)
            ], {
                // graphic dict
                still: new Graphic("spirit/sorrow_bas", ["enemy"], ".png", 0.25)
            }, function(self, cycles) {
                // move funct
                let prevPos = [self.pos[0], self.pos[1]];
                let distSqd = ce.distance(Player.pos, self.pos, false);

                // cycle 0 stuff
                if (cycles === 0) {
                    self.randomOffset = Math.random()*Math.PI*2;
                }

                // velocity change
                if (distSqd <= 1500**2) {
                    self.velo = ce.move(self.velo, ce.dirToTarget(self.pos, Player.pos), (0.1+Math.sin(cycles*Math.PI*2/60+self.randomOffset)*0.15) * ((distSqd <= 1000**2)? -1 : 1));
                }
                
                // movement
                for (let i = 0; i < 2; i++) {
                    self.pos[i] += self.velo[i];
                    self.velo[i] *= 0.95;
                }

                // collision detection
                self.updatePos(self.colArr[0]);
            }, function(self, cycles) {
                // bullet funct
                let distSqd = ce.distance(Player.pos, self.pos, false);
                let dirToPlayer = ce.dirToTarget(self.pos, Player.pos)
                if (distSqd <= 1500**2 && cycles % 120 === 0) {
                    // trail shots
                    shot.slam.play(self.pos);
                    spawnRing(new MBullet(false, {
                        pos: self.pos,
                        type: MBullet.types.star,
                        dir: Math.random()*360,
                        speed: 20,
                        damage: 20,
                        color: [0,128,255],
                        size: 3
                    }, [
                        mod.moveTimer(600),
                        mod.moveAccel(-0.5, 10),
                        mod.moveSpin(6),
                        mod.moveSpawnBulletTimer(10, 10, new MBullet(false, {
                            pos: [0,0],
                            type: MBullet.types.orb,
                            dir: 0,
                            speed: 0,
                            damage: 10,
                            color: [0,0,255],
                            size: 2
                        }, [
                            mod.moveTimer(180)
                        ]), 1, true, true, shot.tap, 0.1)
                    ]), 3)

                    // ring shots
                    spawnRing(new MBullet(false, {
                        pos: self.pos,
                        type: MBullet.types.rice,
                        dir: Math.random()*360,
                        speed: 10,
                        damage: 10,
                        color: [0,255,255],
                        size: 2
                    }, [
                        mod.moveTimer(180),
                        mod.moveAccel(-0.5, 5)
                    ]), 16)
                }
                if (distSqd <= 800**2 && cycles % 5 === 0) {
                    // random rice shots
                    spawnBullet(new MBullet(false, {
                        pos: self.pos,
                        type: MBullet.types.rice,
                        dir: Math.random()*360,
                        speed: 10,
                        color: [0,0,255],
                        size: 1.5,
                        indicator: true
                    }, [
                        mod.moveTimer(30+Math.random()*30),
                        mod.moveAccel(-0.5, 2+Math.random()*3)
                    ]))
                }
            }, "still", true),
            rageBas: new Enemy([0,0], 20, [
                // collision arr
                new HitCircle([0,0], 30, false, true)
            ], {
                // graphic dict
                still: new Graphic("spirit/rage_bas", ["enemy"], ".png", 0.25)
            }, function(self, cycles) {
                // move funct
                let prevPos = [self.pos[0], self.pos[1]];
                let distSqd = ce.distance(Player.pos, self.pos, false);

                // velocity change
                if (self.triggered) {
                    self.fuse--;
                } else {
                    if (distSqd <= 800**2) {
                        self.velo = ce.move(self.velo, ce.dirToTarget(self.pos, Player.pos), 1);
                    }
                    if (distSqd <= 200**2) {
                        // start fuse
                        self.triggered = true;
                        self.fuse = 30;
                        return;
                    }
                }
                
                // movement
                for (let i = 0; i < 2; i++) {
                    self.pos[i] += self.velo[i];
                    self.velo[i] *= (self.triggered)? 0.75 : 0.98;
                }

                // collision detection
                self.updatePos(self.colArr[0]);
            }, function(self, cycles) {
                // bullet funct
                if (self.triggered) {
                    if (self.fuse <= 0) {
                        // suicide explosion
                        shot.blast.play(self.pos);
                        for (let i = 0; i < 200; i++) {
                            let speed = 5+Math.random()*25
                            let size = 1+Math.random()*2
                            spawnBullet(new MBullet(
                                false, {
                                    type: MBullet.types.star,
                                    pos: self.pos,
                                    dir: Math.random()*360,
                                    speed: speed*2,
                                    damage: speed*size/5,
                                    color: [255, Math.random()*255, 0],
                                    size: size,
                                    destroyable: false
                                }, [
                                    mod.moveAccel(-speed/10, speed),
                                    mod.moveTimer(10+Math.floor(Math.random()*20)),
                                    mod.moveSpin(Math.random()*20-10),
                                    mod.moveRot(-5+Math.random()*10)
                                ]
                            ))
                        }
                        self.health = 0;
                    } else {
                        let speed = 5+Math.random()*10
                        spawnBullet(new MBullet(
                            false, {
                                pos: self.pos,
                                dir: Math.random()*360,
                                speed: speed*2,
                                damage: 2,
                                color: [255, Math.random()*255, 0],
                                size: 0.2+Math.random()*0.8
                            }, [
                                mod.moveAccel(-speed/10, speed),
                                mod.moveTimer(10)
                            ]
                        ))
                    }
                }
            }, "still", true),
        }
    }

    static spawnEnemy(pos=[0,0], type="neutral", level=1) {
        let levelStr = "";
        switch (level) {
            case 1:
                levelStr = "Bas";
                break;
            case 2:
                levelStr = "Int";
                break;
            case 3:
                leveStr = "Adv";
                break;
        }
        return Enemy.templateDict[type+levelStr].clone(pos);
    }
}