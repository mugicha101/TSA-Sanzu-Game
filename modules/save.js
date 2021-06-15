import {MapObject, Graphic} from "./mapObj.js";
import {Player, PlayerProj} from "./player.js"
import {Collision, HitBox, HitCircle} from './collisions.js';
import * as ce from './canvasExtension.js';
import {Enemy} from "./enemy.js";
import {MBullet, spawnBullet} from "./bullets.js";
import * as mod from "./bulletMods.js";
import {Trigger} from "./stage.js";
import {Sound} from "./audio.js";
import {Dialog} from "./dialog.js";
export {SaveStatue, Save, RecallStatue};

class SaveStatue {
    static ssDict = {};
    static nextId = 0;
    #activated = false;
    trigger = null;
    constructor(pos) {
        this.id = SaveStatue.nextId;
        SaveStatue.ssDict[this.id] = this;
        SaveStatue.nextId++;
        this.pos = pos;
        this.uactG = new Graphic("save_statue/unactivated", ["obj"], ".png", 0.5, 1, 1, [-64,-40,40], 1, null, false);
        this.actG = new Graphic("save_statue/activated", ["obj"], ".png", 0.5, 3, 4, [-64,-40,40], 1, null, false);
        this.activated = false;
        this.actG.hidden = true;
        this.mo = new MapObject(pos, [this.uactG, this.actG], [new HitCircle([0,0], 30, true)], [-16*4, -40, 16*4, 64*4-40]);
        let self = this;
        this.trigger = new Trigger([new HitCircle(pos, 200)], function() {
            self.activated = true;
            Save.save();
            Dialog.call("Checkpoint Set", 1);
        }, false, true, "press {i}E{/i} to set respawn point")
    }

    get activated() {
        return this.#activated;
    }

    set activated(act) {
        if (this.#activated != act) {
            this.actG.hidden = !act;
            this.uactG.hidden = act;
            this.#activated = act;
        }
    }
}

class RecallStatue {
    static rsDict = {};
    static nextId = 0;
    constructor(pos) {
        this.id = RecallStatue.nextId;
        RecallStatue.rsDict[this.id] = this;
        RecallStatue.nextId++;
        this.pos = pos;
        this.mo = new MapObject(pos, [new Graphic("recall_statue", ["obj"], ".png", 0.5, 4, 2, [-64,-36,36], 1, null, false)], [
            new HitBox([-36,-36], [72,72], true),
            new HitBox([-48,-8], [96,12], true)
        ], [
            -12*4, -36,
            12*4, 64*4-36
        ]);
        this.trigger = new Trigger([new HitCircle(pos, 200)], function() {
            RecallStatue.recall();
        }, false, true, "press {i}E{/i} to recall orbs")
    }

    static recall() {
        // recall all player projectiles
        Sound.sounds.retrieveOrb.playDir(90);
        let turnAmount = 360/PlayerProj.projArr.length;
        let initDir = Math.random()*360;
        for (let i in PlayerProj.projArr) {
            if (PlayerProj.projArr[i].firstPickup && PlayerProj.projArr[i].thrown) {
                // get tp pos
                let tpPos = ce.move(Player.pos, initDir + turnAmount*i, 100);

                // spawn indicator trail bullets
                let oPos = ce.flipY(PlayerProj.projArr[i].pos);
                let dist = ce.distance(oPos, tpPos);
                let steps = Math.floor(dist/50);
                let dir = ce.dirToTarget(oPos, tpPos);
                for (let s = 0; s <= steps; s++) {
                    spawnBullet(new MBullet(false, {
                        pos: ce.move(oPos, dir, s/steps*dist),
                        dir: 0,
                        type: MBullet.types.orb,
                        speed: 0,
                        indicator: true,
                        color: [128,0,255]
                    }, [
                        mod.moveTimer(10+2*s)
                    ]))
                }

                // teleport orb
                PlayerProj.projArr[i].pos = [tpPos[0], -tpPos[1]];
                PlayerProj.projArr[i].thrown = false;
            }
        }
    }
}

const Save = {
    saveData: null,
    saveFunctArr: [], // stage functions that run when game is saved
    loadFunctArr: [], // stage functions that run when save is loaded
    save: function() {
        let sd = {};
        // SAVE DATA
        // player position and camera position
        sd.playerPos = [Player.pos[0], Player.pos[1]];
        sd.camPosTarget = [Player.camPosTarget[0], Player.camPosTarget[1]];
        // player projectile data
        sd.playerProjArr = [];
        for (let i = 0; i < PlayerProj.projArr.length; i++) {
            let proj = PlayerProj.projArr[i];
            sd.playerProjArr.push({
                thrown: proj.thrown,
                pos: [proj.pos[0], proj.pos[1]],
                velo: [proj.velo[0], proj.velo[1]],
                hVelo: proj.hVelo,
                height: proj.height
            })
        }
        // save enemies alive
        sd.eDict = {};
        for (let key in Enemy.eDict) {
            let e = Enemy.eDict[key];
            if (e.dead) continue;
            sd.eDict[key] = e.clone(e.pos, true, e.id);
        }
        // save trigger objects
        sd.tEnabledDict = {};
        for (let key in Trigger.objDict) {
            sd.tEnabledDict[key] = Trigger.objDict[key].enabled;
        }

        // save and run save functions
        for (let i = 0; i < this.saveFunctArr.length; i++) {
            this.saveFunctArr[i](sd);
        }
        this.saveData = sd;
        console.log("Saved")
    },
    load: function() {
        let sd = this.saveData;
        MapObject.utUpdate = true;
        // player stats
        Player.pos = [sd.playerPos[0], sd.playerPos[1]];
        Player.health = Player.maxHealth;
        Player.regenPause = 0;
        Player.velo = [0,0];
        Player.camPosTarget = [sd.camPosTarget[0], sd.camPosTarget[1]];
        // spawn player projectiles
        PlayerProj.projArr = [];
        PlayerProj.projCount = 0;
        PlayerProj.reserveCount = 0;
        PlayerProj.thrownCount = 0;
        for (let i = 0; i < sd.playerProjArr.length; i++) {
            let data = sd.playerProjArr[i];
            let proj = new PlayerProj([data.pos[0], data.pos[1]], [data.velo[0], data.velo[1]]);
            proj.height = data.height;
            proj.thrown = data.thrown;
            proj.hVelo = data.hVelo;
            PlayerProj.projArr.push(proj);
        }

        // clear bullets
        MBullet.bArr = [];

        // spawn enemies
        for (let id in Enemy.eDict) {
            Enemy.eDict[id].remove();
        }
        Enemy.eDict = {};
        for (let key in sd.eDict) {
            let e = sd.eDict[key];
            e.clone(e.pos, false, e.id);
        }

        // set trigger states
        for (let key in sd.tEnabledDict) {
            if (!(key in Trigger.objDict)) continue;
            Trigger.objDict[key].enabled = sd.tEnabledDict[key];
        }

        // run load function
        for (let i = 0; i < this.loadFunctArr.length; i++) {
            this.loadFunctArr[i](sd);
        }
    }
}