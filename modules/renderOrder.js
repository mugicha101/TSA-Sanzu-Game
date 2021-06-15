import {MBullet, drawBullet} from "./bullets.js"
import {Enemy} from "./enemy.js"
import {MainLoop, Draw, zoom} from "./main.js"
import { Graphic, MapObject, BVH } from './mapObj.js';
import {Player, PlayerProj} from "./player.js"
import * as ce from './canvasExtension.js';

const canvas = ce.canvas
const c = canvas.getContext("2d", {alpha: false})

class PlayerPlaceholder {
    constructor() {}
}

/* REASON WHY WE CAN'T JUST ADD RENDEROBJ TO OBJARR WHEN OBJECTS ARE CREATED:

when an object is deleted, since js has no destructor method, it remains in the RenderObj.objArr even though it should be deleted.

To combat this, we just recreate RenderObj.objArr every frame instead of worrying about a custom destructor (it's a lot easier)

*/
export class RenderObj { // responsible for render order of certain objects so that objects near front are rendered on top
    static objArr = [];
    constructor(obj, type) {
        this.obj = obj;
        this.y = null;
        this.type = type;
        switch (type) {
            case "MBullet":
                this.y = obj.pos[1];
                break;
            case "Player":
                this.y = Player.pos[1];
                break;
            case "PlayerProj":
                this.y = -obj.pos[1];
                break;
            case "Enemy":
                this.y = obj.pos[1];
                break;
            case "MOGraphic":
                this.y = null;
                break;
        }
    }

    static updateObjArr() { // takes all objects that need to be rendered and puts them into RenderObj.objArr
        RenderObj.objArr = [];

        // include player
        RenderObj.objArr.push(new RenderObj(new PlayerPlaceholder(), "Player"));

        // include bullets
        for (let i in MBullet.bArr) {
            let obj = MBullet.bArr[i];
            let ro = new RenderObj(obj, "MBullet")
            ro.index = i;
            RenderObj.objArr.push(ro);
        }

        // include playerprojs
        for (let i in PlayerProj.projArr) {
            let obj = PlayerProj.projArr[i];
            RenderObj.objArr.push(new RenderObj(obj, "PlayerProj"));
        }

        // include enemies
        for (let i in Enemy.eDict) {
            let obj = Enemy.eDict[i];
            // detect if off screen
            let offscreen = false;
            for (let i = 0; i < 2; i++) {
                if (Math.abs(obj.pos[i] - Player.camPos[i]) > (ce.screenDim[i]/zoom + 2000)/2) {
                    offscreen = true;
                    break;
                }
            }
            if (offscreen) continue;
            RenderObj.objArr.push(new RenderObj(obj, "Enemy"));
        }

        // include mapobject graphics that use 2.5D rendering
        let canidates = BVH.getColCanidates(Draw.camHB);
        for (let i = 0; i < canidates.length; i++) {
            let mo = canidates[i];
            if (mo.hidden || mo.alpha <= 0) continue;
            mo.gArr.forEach(function(g,index) {
                if (g.hidden || g.alpha <= 0) return;
                if (g.layers.includes("obj") || g.layers.includes("wall")) {
                    let img = g.getImage();
                    let pos = [mo.pos[0] + g.offset[0], -mo.pos[1] - img.height*g.scale - g.offset[1]]
                    let imgDim = [img.width, img.height]
                    // detect if off screen
                    for (let i = 0; i < 2; i++) {
                        if (Math.abs(mo.pos[i] + g.offset[i] + imgDim[i]*g.scale/2 - Player.camPos[i]) > (ce.screenDim[i]/zoom +imgDim[i]*g.scale)/2) {
                            return;
                        }
                    }
                    let ro = new RenderObj(g, "MOGraphic")
                    ro.pos = [mo.pos[0] + g.offset[0], mo.pos[1] + g.offset[1]];
                    ro.y = ro.pos[1]+g.offset[2];
                    ro.alpha = mo.alpha * g.alpha;
                    ro.mo = mo;
                    RenderObj.objArr.push(ro);
                }
            })
        }
        
    }

    static draw() {
        RenderObj.updateObjArr(); // fill objArr
        let i = 0;
        RenderObj.objArr.sort((a, b) => {
            return b.y - a.y;
        });
        let a = 0;
        for (let i in RenderObj.objArr) {
            let ro = RenderObj.objArr[i];
            switch (ro.type) {
                case "MBullet":
                    c.resetTrans();
                    Draw.camCanvasOffset();
                    drawBullet(ro.obj, ro.obj.index);
                    break;
                case "Player":
                    Player.draw();
                    break;
                case "PlayerProj":
                    ro.obj.draw();
                    break;
                case "Enemy":
                    ro.obj.draw();
                    break;
                case "MOGraphic":
                    let alpha = ro.alpha;
                    let img = ro.obj.getImage();

                    if (!Player.farSightMode && ro.obj.behindFade) {
                        let distArr = [
                            ro.mo.aabb[3] - Player.pos[1],
                            Player.pos[1] - ro.mo.aabb[1],
                            Player.pos[0] - ro.mo.aabb[0] + 150,
                            ro.mo.aabb[2] - Player.pos[0] + 150
                        ]
                        let minDist = distArr[0];
                        for (let i = 1; i < distArr.length; i++) {
                            if (distArr[i] < minDist)
                                minDist = distArr[i];
                        }
                        
                        let alphaMulti = 1-minDist/300;
                        if (alphaMulti < 0.5) alphaMulti = 0.5;
                        if (alphaMulti > 1) alphaMulti = 1;
                        alpha *= alphaMulti;
                    }
                    
                    c.resetTrans();
                    Draw.camCanvasOffset();
                    if (alpha != 1) c.globalAlpha = alpha;
                    c.transformCanvas(ro.obj.scale, 0, ro.pos[0], -ro.pos[1] - img.height*ro.obj.scale)
                    c.drawImage(img, 0, 0)
                    if (alpha != 1) c.globalAlpha = 1;
            }
        }
    }
}