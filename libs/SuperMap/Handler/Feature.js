/* COPYRIGHT 2012 SUPERMAP
 * 本程序只能在有效的授权许可下使用。
 * 未经许可，不得以任何手段擅自使用或传播。*/


/**
 * @requires SuperMap/Handler.js
 */

/**
 * Class: SuperMap.Handler.Feature 
 * 绘制要素的鼠标事件的事件处理器。回调函数中定义的与绘制要素相关的如下事件：click, clickout, over, out 和 dblclick等，会在对应操作完成后得到触发通知。
 */
SuperMap.Handler.Feature = SuperMap.Class(SuperMap.Handler, {
    /**
     * APIProperty: delay
     * {Number} 两次单击事件的最小间隔毫秒数，间隔小于该值则认为是双击事件。
     */
    delay: 300,

    /**
     * Property: EVENTMAP
     * {Object} A object mapping the browser events to objects with callback
     *     keys for in and out.
     */
    EVENTMAP: {
        'click': {'in': 'click', 'out': 'clickout'},
        'mousemove': {'in': 'over', 'out': 'out'},
        'dblclick': {'in': 'dblclick', 'out': null},
        'mousedown': {'in': null, 'out': null},
        'mouseup': {'in': null, 'out': null},
        'touchstart': {'in': 'click', 'out': 'clickout'},
        'contextmenu': {'in': 'rightclick', 'out': null}
    },

    /**
     * APIProperty: single
     * {Boolean} 单击事件，默认为 true。
     */
    single: true,

    /**
     * APIProperty: double
     * {Boolean} 双击事件,默认为 true。
     */
    'double': true,

    /**
     * Property: timerId
     * {Number} The id of the timeout waiting to clear the <delayedCall>.
     */
    timerId: null,

    /**
     * Property: touch
     * {Boolean} When a touchstart event is fired, touch will be true and all
     *     mouse related listeners will do nothing.
     */
    touch: false,

    /**
     * Property: last
     * {Object} Object that store relevant information about the last
     *     mousemove or touchmove. Its 'xy' SuperMap.Pixel property gives
     *     the average location of the mouse/touch event. Its 'touches'
     *     property records clientX/clientY of each touches.
     */
    last: null,

    /**
     * Property: first
     * {Object} When waiting for double clicks, this object will store
     *     information about the first click in a two click sequence.
     */
    first: null,

    /**
     * Property: feature
     * {<SuperMap.Feature.Vector>} The last feature that was hovered.
     */
    feature: null,

    /**
     * Property: lastFeature
     * {<SuperMap.Feature.Vector>} The last feature that was handled.
     */
    lastFeature: null,

    /**
     * Property: down
     * {<SuperMap.Pixel>} The location of the last mousedown.
     */
    down: null,

    /**
     * Property: up
     * {<SuperMap.Pixel>} The location of the last mouseup.
     */
    up: null,

    /**
     * Property: touch
     * {Boolean} When a touchstart event is fired, touch will be true and all
     *     mouse related listeners will do nothing.
     */
    touch: false,
    
    /**
     * Property: clickTolerance
     * {Number} The number of pixels the mouse can move between mousedown
     *     and mouseup for the event to still be considered a click.
     *     Dragging the map should not trigger the click and clickout callbacks
     *     unless the map is moved by less than this tolerance. Defaults to 4.
     */
    clickTolerance: 4,

    /**
     * Property: geometryTypes
     * To restrict dragging to a limited set of geometry types, send a list
     * of strings corresponding to the geometry class names.
     * 
     * @type Array(String)
     */
    geometryTypes: null,

    /**
     * Property: stopClick
     * {Boolean} If stopClick is set to true, handled clicks do not
     *      propagate to other click listeners. Otherwise, handled clicks
     *      do propagate. Unhandled clicks always propagate, whatever the
     *      value of stopClick. Defaults to true.
     */
    stopClick: true,

    /**
     * Property: stopDown
     * {Boolean} If stopDown is set to true, handled mousedowns do not
     *      propagate to other mousedown listeners. Otherwise, handled
     *      mousedowns do propagate. Unhandled mousedowns always propagate,
     *      whatever the value of stopDown. Defaults to true.
     */
    stopDown: true,

    /**
     * Property: stopUp
     * {Boolean} If stopUp is set to true, handled mouseups do not
     *      propagate to other mouseup listeners. Otherwise, handled mouseups
     *      do propagate. Unhandled mouseups always propagate, whatever the
     *      value of stopUp. Defaults to false.
     */
    stopUp: false,
    
    /**
     * Constructor: SuperMap.Handler.Feature
     * 创建一个新的绘制要素的事件处理器对象
     * 
     * Parameters:
     * control - {<SuperMap.Control>} 构建事件处理器对象的控件，如果控件拥有一个有效的地图属性引用，
     * 则会被handler的seMap方法使用。如果在options中设置了map属性，则使用设置的属性。
     * layer - {<SuperMap.Layer.Vector>} 矢量图层对象。
     * callbacks - {Object} 回调对象，包含属性'over'并且其属性值为鼠标移到绘制要素上的响应函数，
     * 这个响应函数需要传入当前绘制要素作为参数。
     * options - {Object} 一个可选对象，其属性将会赋值到事件处理器对象上。
     */
    initialize: function(control, layer, callbacks, options) {
        SuperMap.Handler.prototype.initialize.apply(this, [control, callbacks, options]);
        this.layer = layer;
    },

    /**
     * Method: touchstart
     * Handle touchstart events
     *
     * Parameters:
     * evt - {Event}
     *
     * Returns:
     * {Boolean} Let the event propagate.
     */
    touchstart: function(evt) {
        if(!this.touch) {
            this.touch =  true;
            this.map.events.un({
                mousedown: this.mousedown,
                mouseup: this.mouseup,
                mousemove: this.mousemove,
                click: this.click,
                dblclick: this.dblclick,
                scope: this
            });
        }
        this.singleTouch=SuperMap.Event.isMultiTouch(evt)?false:true;
        return this.singleTouch ? this.mousedown(evt) : true;
    },

    /**
     * Method: touchmove
     * Handle touchmove events. We just prevent the browser default behavior,
     *    for Android Webkit not to select text when moving the finger after
     *    selecting a feature.
     *
     * Parameters:
     * evt - {Event}
     */
    touchmove: function(evt) {
        this.singleTouch=false;
        SuperMap.Event.stop(evt);
    },

    /**
     * Method: mousedown
     * Handle mouse down.  Stop propagation if a feature is targeted by this
     *     event (stops map dragging during feature selection).
     * 
     * Parameters:
     * evt - {Event} 
     */
    mousedown: function(evt) {
        if (SuperMap.Event.isLeftClick(evt) || SuperMap.Event.isSingleTouch(evt)) {
        	this.down = evt.xy;
        }
        return this.handle(evt) ? !this.stopDown : true;
    },
    
    /**
     * Method: mouseup
     * Handle mouse up.  Stop propagation if a feature is targeted by this
     *     event.
     * 
     * Parameters:
     * evt - {Event} 
     */
    mouseup: function(evt) {
        this.up = evt.xy;
        return this.handle(evt) ? !this.stopUp : true;
    },


    /**
     * Method: click
     * Handle click events from the browser.  This is registered as a listener
     *     for click events and should not be called from other events in this
     *     handler.
     *
     * Returns:
     * {Boolean} Continue propagating this event.
     */
    click: function(evt) {
        if (!this.last) {
            this.last = this.getEventInfo(evt);
        }
        return this.handleSingle(evt) ? !this.stopClick : true;
    },

    /**
     * Method: dblclick
     * Handle dblclick.  For a dblclick, we get two clicks in some browsers
     *     (FF) and one in others (IE).  So we need to always register for
     *     dblclick to properly handle single clicks.  This method is registered
     *     as a listener for the dblclick browser event.  It should *not* be
     *     called by other methods in this handler.
     *
     * Returns:
     * {Boolean} Continue propagating this event.
     */
    dblclick: function(evt) {
        return this.handleDouble(evt);
    },

    /**
     * Method: handleDouble
     * Handle double-click sequence.
     */
    handleDouble: function(evt) {
        if (this["double"]) {
            evt.type = 'dblclick';
            return !this.handle(evt);
            //this.callback("dblclick", [evt]);
        }
    },

    /**
     * Method: handleSingle
     * Handle single click sequence.
     */
    handleSingle: function(evt) {
        if (this.timerId != null) {
            // already received a click
            if (this.last.touches && this.last.touches.length === 1) {
                // touch device, no dblclick event - this may be a double
                if (this["double"]) {
                    // on Android don't let the browser zoom on the page
                    SuperMap.Event.stop(evt);
                }
                this.handleDouble(evt);
            }
            // if we're not in a touch environment we clear the click timer
            // if we've got a second touch, we'll get two touchend events
            if (!this.last.touches || this.last.touches.length !== 2) {
                this.clearTimer();
            }
        } else {
            // remember the first click info so we can compare to the second
            this.first = this.getEventInfo(evt);
            // set the timer, send evt only if single is true
            //use a clone of the event object because it will no longer
            //be a valid event object in IE in the timer callback
            var clickEvent = this.single ?
                SuperMap.Util.extend({}, evt) : null;
            this.queuePotentialClick(clickEvent);
        }
    },

    /**
     * Method: queuePotentialClick
     * This method is separated out largely to make testing easier (so we
     *     don't have to override window.setTimeout)
     */
    queuePotentialClick: function(evt) {
        this.timerId = window.setTimeout(
            SuperMap.Function.bind(this.delayedCall, this, evt),
            this.delay
        );
    },

    /**
     * Method: delayedCall
     * Sets <timerId> to null.  And optionally triggers the click callback if
     *     evt is set.
     */
    delayedCall: function(evt) {
        this.timerId = null;
        if (evt) {
            return this.handle(evt) ? !this.stopClick : true;
        }
    },

    /**
     * Method: clearTimer
     * Clear the timer and set <timerId> to null.
     */
    clearTimer: function() {
        if (this.timerId != null) {
            window.clearTimeout(this.timerId);
            this.timerId = null;
        }
        if (this.rightclickTimerId != null) {
            window.clearTimeout(this.rightclickTimerId);
            this.rightclickTimerId = null;
        }
    },
    /**
     * Method: getEventInfo
     * This method allows us to store event information without storing the
     *     actual event.  In touch devices (at least), the same event is
     *     modified between touchstart, touchmove, and touchend.
     *
     * Returns:
     * {Object} An object with event related info.
     */
    getEventInfo: function(evt) {
        var touches;
        if (evt.touches) {
            var len = evt.touches.length;
            touches = new Array(len);
            var touch;
            for (var i=0; i<len; i++) {
                touch = evt.touches[i];
                touches[i] = {
                    clientX: touch.clientX,
                    clientY: touch.clientY
                };
            }
        }
        return {
            xy: evt.xy,
            touches: touches
        };
    },
        
    /**
     * Method: contextmenu
     * Handle contextmenu.  Call the "contextmenu" callback if rightclick on a feature,
     *
     * Parameters:
     * evt - {Event}
     *
     * Returns:
     * {Boolean}
     */
    contextmenu: function(evt) {
        if(evt.preventDefault){
            evt.preventDefault();
        }
        else{evt.returnValue=false;} //IE8下阻止默认事件
        return this.handle(evt) ? !this.stopClick : true;
    },

    /**
     * Method: mousemove
     * Handle mouse moves.  Call the "over" callback if moving in to a feature,
     *     or the "out" callback if moving out of a feature.
     * 
     * Parameters:
     * evt - {Event} 
     *
     * Returns:
     * {Boolean}
     */
    mousemove: function(evt) {
        if (!this.callbacks['over'] && !this.callbacks['out']) {
            return true;
        }     
        this.handle(evt);
        return true;
    },

    /**
     * Method: geometryTypeMatches
     * Return true if the geometry type of the passed feature matches
     *     one of the geometry types in the geometryTypes array.
     *
     * Parameters:
     * feature - {<SuperMap.Vector.Feature>}
     *
     * Returns:
     * {Boolean}
     */
    geometryTypeMatches: function(feature) {
        return this.geometryTypes == null ||
            SuperMap.Util.indexOf(this.geometryTypes,
                                    feature.geometry.CLASS_NAME) > -1;
    },

    /**
     * Method: handle
     *
     * Parameters:
     * evt - {Event}
     *
     * Returns:
     * {Boolean} The event occurred over a relevant feature.
     */
    handle: function(evt) {
        if(this.feature && !this.feature.layer) {
            // feature has been destroyed
            this.feature = null;
        }
        var type = evt.type;
        var handled = false;
        var previouslyIn = !!(this.feature); // previously in a feature
        var click = (type === "click" || type === "dblclick" ||type==="contextmenu"||type==="touchstart");
        this.feature = this.layer.getFeatureFromEvent(evt);
        if(this.feature && !this.feature.layer) {
            // feature has been destroyed
            this.feature = null;
        }
        if(this.lastFeature && !this.lastFeature.layer) {
            // last feature has been destroyed
            this.lastFeature = null;
        }
        if(this.feature) {
            if(type === "touchstart") {
                // stop the event to prevent Android Webkit from
                // "flashing" the map div
                SuperMap.Event.stop(evt);
            }
            var inNew = (this.feature !== this.lastFeature);
            if(this.geometryTypeMatches(this.feature)) {
                // in to a feature
                if(previouslyIn && inNew) {
                    // out of last feature and in to another
                    if(this.lastFeature) {
                        this.triggerCallback(type, 'out', [this.lastFeature, evt]);
                    }
                    this.triggerCallback(type, 'in', [this.feature, evt]);
                } else if(!previouslyIn || click) {
                    // in feature for the first time
                    this.triggerCallback(type, 'in', [this.feature, evt]);
                }
                this.lastFeature = this.feature;
                handled = true;
            } else {
                // not in to a feature
                if(this.lastFeature && (previouslyIn && inNew || click)) {
                    // out of last feature for the first time
                    this.triggerCallback(type, 'out', [this.lastFeature, evt]);
                }
                // next time the mouse goes in a feature whose geometry type
                // doesn't match we don't want to call the 'out' callback
                // again, so let's set this.feature to null so that
                // previouslyIn will evaluate to false the next time
                // we enter handle. Yes, a bit hackish...
                this.feature = null;
            }
        } else {
            if(this.lastFeature && (previouslyIn || click)) {
                this.triggerCallback(type, 'out', [this.lastFeature, evt]);
            }
        }
        return handled;
    },
    
    /**
     * Method: triggerCallback
     * Call the callback keyed in the event map with the supplied arguments.
     *     For click and clickout, the <clickTolerance> is checked first.
     *
     * Parameters:
     * type - {String}
     */
    triggerCallback: function(type, mode, args) {
        var key = this.EVENTMAP[type][mode];
        if(key) {
            if(type === 'click' && this.up && this.down) {
                // for click/clickout, only trigger callback if tolerance is met
                var dpx = Math.sqrt(
                    Math.pow(this.up.x - this.down.x, 2) +
                    Math.pow(this.up.y - this.down.y, 2)
                );
                if(dpx <= this.clickTolerance) {
                    this.callback(key, args);
                }
            } else {
                this.callback(key, args);
            }
        }
    },

    /**
     * Method: activate 
     * Turn on the handler.  Returns false if the handler was already active.
     *
     * Returns:
     * {Boolean}
     */
    activate: function() {
        var activated = false;
        if(SuperMap.Handler.prototype.activate.apply(this, arguments)) {
            this.moveLayerToTop();
            this.map.events.on({
                "removelayer": this.handleMapEvents,
                "changelayer": this.handleMapEvents,
                scope: this
            });
            activated = true;
        }
        return activated;
    },
    
    /**
     * Method: deactivate 
     * Turn off the handler.  Returns false if the handler was already active.
     *
     * Returns: 
     * {Boolean}
     */
    deactivate: function() {
        var deactivated = false;
        if(SuperMap.Handler.prototype.deactivate.apply(this, arguments)) {
            this.moveLayerBack();
            this.feature = null;
            this.lastFeature = null;
            this.down = null;
            this.up = null;
            this.touch = false;
            this.map.events.un({
                "removelayer": this.handleMapEvents,
                "changelayer": this.handleMapEvents,
                scope: this
            });
            deactivated = true;
        }
        return deactivated;
    },
    
    /**
     * Method handleMapEvents
     * 
     * Parameters:
     * evt - {Object}
     */
    handleMapEvents: function(evt) {
        if (evt.type === "removelayer" || evt.property === "order") {
            this.moveLayerToTop();
        }
    },
    
    /**
     * Method: moveLayerToTop
     * Moves the layer for this handler to the top, so mouse events can reach
     * it.
     */
    moveLayerToTop: function() {
        var index = Math.max(this.map.Z_INDEX_BASE['Overlay'] - 1,
            this.layer.getZIndex()) + 1;
        this.layer.setZIndex(index);
    },
    
    /**
     * Method: moveLayerBack
     * Moves the layer back to the position determined by the map's layers
     * array.
     */
    moveLayerBack: function() {
        var index = this.layer.getZIndex() - 1;
        if (index >= this.map.Z_INDEX_BASE['Overlay']) {
            this.layer.setZIndex(index);
        } else {
            this.map.setLayerZIndex(this.layer,
                this.map.getLayerIndex(this.layer));
        }
    },

    CLASS_NAME: "SuperMap.Handler.Feature"
});
