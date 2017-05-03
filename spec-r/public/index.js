(function () {
'use strict';

function __$styleInject(css, returnValue) {
  if (typeof document === 'undefined') {
    return returnValue;
  }
  css = css || '';
  var head = document.head || document.getElementsByTagName('head')[0];
  var style = document.createElement('style');
  style.type = 'text/css';
  if (style.styleSheet){
    style.styleSheet.cssText = css;
  } else {
    style.appendChild(document.createTextNode(css));
  }
  head.appendChild(style);
  return returnValue;
}
/** Virtual DOM Node */
function VNode() {}

/** Global options
 *	@public
 *	@namespace options {Object}
 */
var options = {

	/** If `true`, `prop` changes trigger synchronous component updates.
	 *	@name syncComponentUpdates
	 *	@type Boolean
	 *	@default true
	 */
	//syncComponentUpdates: true,

	/** Processes all created VNodes.
	 *	@param {VNode} vnode	A newly-created VNode to normalize/process
	 */
	//vnode(vnode) { }

	/** Hook invoked after a component is mounted. */
	// afterMount(component) { }

	/** Hook invoked after the DOM is updated with a component's latest render. */
	// afterUpdate(component) { }

	/** Hook invoked immediately before a component is unmounted. */
	// beforeUnmount(component) { }
};

const stack = [];

const EMPTY_CHILDREN = [];

/** JSX/hyperscript reviver
*	Benchmarks: https://esbench.com/bench/57ee8f8e330ab09900a1a1a0
 *	@see http://jasonformat.com/wtf-is-jsx
 *	@public
 */
function h(nodeName, attributes) {
	let children=EMPTY_CHILDREN, lastSimple, child, simple, i;
	for (i=arguments.length; i-- > 2; ) {
		stack.push(arguments[i]);
	}
	if (attributes && attributes.children!=null) {
		if (!stack.length) stack.push(attributes.children);
		delete attributes.children;
	}
	while (stack.length) {
		if ((child = stack.pop()) && child.pop!==undefined) {
			for (i=child.length; i--; ) stack.push(child[i]);
		}
		else {
			if (child===true || child===false) child = null;

			if ((simple = typeof nodeName!=='function')) {
				if (child==null) child = '';
				else if (typeof child==='number') child = String(child);
				else if (typeof child!=='string') simple = false;
			}

			if (simple && lastSimple) {
				children[children.length-1] += child;
			}
			else if (children===EMPTY_CHILDREN) {
				children = [child];
			}
			else {
				children.push(child);
			}

			lastSimple = simple;
		}
	}

	let p = new VNode();
	p.nodeName = nodeName;
	p.children = children;
	p.attributes = attributes==null ? undefined : attributes;
	p.key = attributes==null ? undefined : attributes.key;

	// if a "vnode hook" is defined, pass every created VNode to it
	if (options.vnode!==undefined) options.vnode(p);

	return p;
}

/** Copy own-properties from `props` onto `obj`.
 *	@returns obj
 *	@private
 */
function extend(obj, props) {
	for (let i in props) obj[i] = props[i];
	return obj;
}

// render modes

const NO_RENDER = 0;
const SYNC_RENDER = 1;
const FORCE_RENDER = 2;
const ASYNC_RENDER = 3;


const ATTR_KEY = '__preactattr_';

// DOM properties that should NOT have "px" added when numeric
const IS_NON_DIMENSIONAL = /acit|ex(?:s|g|n|p|$)|rph|ows|mnc|ntw|ine[ch]|zoo|^ord/i;

/** Managed queue of dirty components to be re-rendered */

let items = [];

function enqueueRender(component) {
	if (!component._dirty && (component._dirty = true) && items.push(component)==1) {
		(options.debounceRendering || setTimeout)(rerender);
	}
}


function rerender() {
	let p, list = items;
	items = [];
	while ( (p = list.pop()) ) {
		if (p._dirty) renderComponent(p);
	}
}

/** Check if two nodes are equivalent.
 *	@param {Element} node
 *	@param {VNode} vnode
 *	@private
 */
function isSameNodeType(node, vnode, hydrating) {
	if (typeof vnode==='string' || typeof vnode==='number') {
		return node.splitText!==undefined;
	}
	if (typeof vnode.nodeName==='string') {
		return !node._componentConstructor && isNamedNode(node, vnode.nodeName);
	}
	return hydrating || node._componentConstructor===vnode.nodeName;
}


/** Check if an Element has a given normalized name.
*	@param {Element} node
*	@param {String} nodeName
 */
function isNamedNode(node, nodeName) {
	return node.normalizedNodeName===nodeName || node.nodeName.toLowerCase()===nodeName.toLowerCase();
}


/**
 * Reconstruct Component-style `props` from a VNode.
 * Ensures default/fallback values from `defaultProps`:
 * Own-properties of `defaultProps` not present in `vnode.attributes` are added.
 * @param {VNode} vnode
 * @returns {Object} props
 */
function getNodeProps(vnode) {
	let props = extend({}, vnode.attributes);
	props.children = vnode.children;

	let defaultProps = vnode.nodeName.defaultProps;
	if (defaultProps!==undefined) {
		for (let i in defaultProps) {
			if (props[i]===undefined) {
				props[i] = defaultProps[i];
			}
		}
	}

	return props;
}

/** Create an element with the given nodeName.
 *	@param {String} nodeName
 *	@param {Boolean} [isSvg=false]	If `true`, creates an element within the SVG namespace.
 *	@returns {Element} node
 */
function createNode(nodeName, isSvg) {
	let node = isSvg ? document.createElementNS('http://www.w3.org/2000/svg', nodeName) : document.createElement(nodeName);
	node.normalizedNodeName = nodeName;
	return node;
}


/** Remove a child node from its parent if attached.
 *	@param {Element} node		The node to remove
 */
function removeNode(node) {
	if (node.parentNode) node.parentNode.removeChild(node);
}


/** Set a named attribute on the given Node, with special behavior for some names and event handlers.
 *	If `value` is `null`, the attribute/handler will be removed.
 *	@param {Element} node	An element to mutate
 *	@param {string} name	The name/key to set, such as an event or attribute name
 *	@param {any} old	The last value that was set for this name/node pair
 *	@param {any} value	An attribute value, such as a function to be used as an event handler
 *	@param {Boolean} isSvg	Are we currently diffing inside an svg?
 *	@private
 */
function setAccessor(node, name, old, value, isSvg) {
	if (name==='className') name = 'class';


	if (name==='key') {
		// ignore
	}
	else if (name==='ref') {
		if (old) old(null);
		if (value) value(node);
	}
	else if (name==='class' && !isSvg) {
		node.className = value || '';
	}
	else if (name==='style') {
		if (!value || typeof value==='string' || typeof old==='string') {
			node.style.cssText = value || '';
		}
		if (value && typeof value==='object') {
			if (typeof old!=='string') {
				for (let i in old) if (!(i in value)) node.style[i] = '';
			}
			for (let i in value) {
				node.style[i] = typeof value[i]==='number' && IS_NON_DIMENSIONAL.test(i)===false ? (value[i]+'px') : value[i];
			}
		}
	}
	else if (name==='dangerouslySetInnerHTML') {
		if (value) node.innerHTML = value.__html || '';
	}
	else if (name[0]=='o' && name[1]=='n') {
		let useCapture = name !== (name=name.replace(/Capture$/, ''));
		name = name.toLowerCase().substring(2);
		if (value) {
			if (!old) node.addEventListener(name, eventProxy, useCapture);
		}
		else {
			node.removeEventListener(name, eventProxy, useCapture);
		}
		(node._listeners || (node._listeners = {}))[name] = value;
	}
	else if (name!=='list' && name!=='type' && !isSvg && name in node) {
		setProperty(node, name, value==null ? '' : value);
		if (value==null || value===false) node.removeAttribute(name);
	}
	else {
		let ns = isSvg && (name !== (name = name.replace(/^xlink\:?/, '')));
		if (value==null || value===false) {
			if (ns) node.removeAttributeNS('http://www.w3.org/1999/xlink', name.toLowerCase());
			else node.removeAttribute(name);
		}
		else if (typeof value!=='function') {
			if (ns) node.setAttributeNS('http://www.w3.org/1999/xlink', name.toLowerCase(), value);
			else node.setAttribute(name, value);
		}
	}
}


/** Attempt to set a DOM property to the given value.
 *	IE & FF throw for certain property-value combinations.
 */
function setProperty(node, name, value) {
	try {
		node[name] = value;
	} catch (e) { }
}


/** Proxy an event to hooked event handlers
 *	@private
 */
function eventProxy(e) {
	return this._listeners[e.type](options.event && options.event(e) || e);
}

/** Queue of components that have been mounted and are awaiting componentDidMount */
const mounts = [];

/** Diff recursion count, used to track the end of the diff cycle. */
let diffLevel = 0;

/** Global flag indicating if the diff is currently within an SVG */
let isSvgMode = false;

/** Global flag indicating if the diff is performing hydration */
let hydrating = false;

/** Invoke queued componentDidMount lifecycle methods */
function flushMounts() {
	let c;
	while ((c=mounts.pop())) {
		if (options.afterMount) options.afterMount(c);
		if (c.componentDidMount) c.componentDidMount();
	}
}


/** Apply differences in a given vnode (and it's deep children) to a real DOM Node.
 *	@param {Element} [dom=null]		A DOM node to mutate into the shape of the `vnode`
 *	@param {VNode} vnode			A VNode (with descendants forming a tree) representing the desired DOM structure
 *	@returns {Element} dom			The created/mutated element
 *	@private
 */
function diff(dom, vnode, context, mountAll, parent, componentRoot) {
	// diffLevel having been 0 here indicates initial entry into the diff (not a subdiff)
	if (!diffLevel++) {
		// when first starting the diff, check if we're diffing an SVG or within an SVG
		isSvgMode = parent!=null && parent.ownerSVGElement!==undefined;

		// hydration is inidicated by the existing element to be diffed not having a prop cache
		hydrating = dom!=null && !(ATTR_KEY in dom);
	}

	let ret = idiff(dom, vnode, context, mountAll, componentRoot);

	// append the element if its a new parent
	if (parent && ret.parentNode!==parent) parent.appendChild(ret);

	// diffLevel being reduced to 0 means we're exiting the diff
	if (!--diffLevel) {
		hydrating = false;
		// invoke queued componentDidMount lifecycle methods
		if (!componentRoot) flushMounts();
	}

	return ret;
}


/** Internals of `diff()`, separated to allow bypassing diffLevel / mount flushing. */
function idiff(dom, vnode, context, mountAll, componentRoot) {
	let out = dom,
		prevSvgMode = isSvgMode;

	// empty values (null & undefined) render as empty Text nodes
	if (vnode==null) vnode = '';


	// Fast case: Strings create/update Text nodes.
	if (typeof vnode==='string') {

		// update if it's already a Text node:
		if (dom && dom.splitText!==undefined && dom.parentNode && (!dom._component || componentRoot)) {
			if (dom.nodeValue!=vnode) {
				dom.nodeValue = vnode;
			}
		}
		else {
			// it wasn't a Text node: replace it with one and recycle the old Element
			out = document.createTextNode(vnode);
			if (dom) {
				if (dom.parentNode) dom.parentNode.replaceChild(out, dom);
				recollectNodeTree(dom, true);
			}
		}

		out[ATTR_KEY] = true;

		return out;
	}


	// If the VNode represents a Component, perform a component diff:
	if (typeof vnode.nodeName==='function') {
		return buildComponentFromVNode(dom, vnode, context, mountAll);
	}


	// Tracks entering and exiting SVG namespace when descending through the tree.
	isSvgMode = vnode.nodeName==='svg' ? true : vnode.nodeName==='foreignObject' ? false : isSvgMode;


	// If there's no existing element or it's the wrong type, create a new one:
	if (!dom || !isNamedNode(dom, String(vnode.nodeName))) {
		out = createNode(String(vnode.nodeName), isSvgMode);

		if (dom) {
			// move children into the replacement node
			while (dom.firstChild) out.appendChild(dom.firstChild);

			// if the previous Element was mounted into the DOM, replace it inline
			if (dom.parentNode) dom.parentNode.replaceChild(out, dom);

			// recycle the old element (skips non-Element node types)
			recollectNodeTree(dom, true);
		}
	}


	let fc = out.firstChild,
		props = out[ATTR_KEY] || (out[ATTR_KEY] = {}),
		vchildren = vnode.children;

	// Optimization: fast-path for elements containing a single TextNode:
	if (!hydrating && vchildren && vchildren.length===1 && typeof vchildren[0]==='string' && fc!=null && fc.splitText!==undefined && fc.nextSibling==null) {
		if (fc.nodeValue!=vchildren[0]) {
			fc.nodeValue = vchildren[0];
		}
	}
	// otherwise, if there are existing or new children, diff them:
	else if (vchildren && vchildren.length || fc!=null) {
		innerDiffNode(out, vchildren, context, mountAll, hydrating || props.dangerouslySetInnerHTML!=null);
	}


	// Apply attributes/props from VNode to the DOM Element:
	diffAttributes(out, vnode.attributes, props);


	// restore previous SVG mode: (in case we're exiting an SVG namespace)
	isSvgMode = prevSvgMode;

	return out;
}


/** Apply child and attribute changes between a VNode and a DOM Node to the DOM.
 *	@param {Element} dom			Element whose children should be compared & mutated
 *	@param {Array} vchildren		Array of VNodes to compare to `dom.childNodes`
 *	@param {Object} context			Implicitly descendant context object (from most recent `getChildContext()`)
 *	@param {Boolean} mountAll
 *	@param {Boolean} isHydrating	If `true`, consumes externally created elements similar to hydration
 */
function innerDiffNode(dom, vchildren, context, mountAll, isHydrating) {
	let originalChildren = dom.childNodes,
		children = [],
		keyed = {},
		keyedLen = 0,
		min = 0,
		len = originalChildren.length,
		childrenLen = 0,
		vlen = vchildren ? vchildren.length : 0,
		j, c, vchild, child;

	// Build up a map of keyed children and an Array of unkeyed children:
	if (len!==0) {
		for (let i=0; i<len; i++) {
			let child = originalChildren[i],
				props = child[ATTR_KEY],
				key = vlen && props ? child._component ? child._component.__key : props.key : null;
			if (key!=null) {
				keyedLen++;
				keyed[key] = child;
			}
			else if (props || (child.splitText!==undefined ? (isHydrating ? child.nodeValue.trim() : true) : isHydrating)) {
				children[childrenLen++] = child;
			}
		}
	}

	if (vlen!==0) {
		for (let i=0; i<vlen; i++) {
			vchild = vchildren[i];
			child = null;

			// attempt to find a node based on key matching
			let key = vchild.key;
			if (key!=null) {
				if (keyedLen && keyed[key]!==undefined) {
					child = keyed[key];
					keyed[key] = undefined;
					keyedLen--;
				}
			}
			// attempt to pluck a node of the same type from the existing children
			else if (!child && min<childrenLen) {
				for (j=min; j<childrenLen; j++) {
					if (children[j]!==undefined && isSameNodeType(c = children[j], vchild, isHydrating)) {
						child = c;
						children[j] = undefined;
						if (j===childrenLen-1) childrenLen--;
						if (j===min) min++;
						break;
					}
				}
			}

			// morph the matched/found/created DOM child to match vchild (deep)
			child = idiff(child, vchild, context, mountAll);

			if (child && child!==dom) {
				if (i>=len) {
					dom.appendChild(child);
				}
				else if (child!==originalChildren[i]) {
					if (child===originalChildren[i+1]) {
						removeNode(originalChildren[i]);
					}
					else {
						dom.insertBefore(child, originalChildren[i] || null);
					}
				}
			}
		}
	}


	// remove unused keyed children:
	if (keyedLen) {
		for (let i in keyed) if (keyed[i]!==undefined) recollectNodeTree(keyed[i], false);
	}

	// remove orphaned unkeyed children:
	while (min<=childrenLen) {
		if ((child = children[childrenLen--])!==undefined) recollectNodeTree(child, false);
	}
}



/** Recursively recycle (or just unmount) a node an its descendants.
 *	@param {Node} node						DOM node to start unmount/removal from
 *	@param {Boolean} [unmountOnly=false]	If `true`, only triggers unmount lifecycle, skips removal
 */
function recollectNodeTree(node, unmountOnly) {
	let component = node._component;
	if (component) {
		// if node is owned by a Component, unmount that component (ends up recursing back here)
		unmountComponent(component);
	}
	else {
		// If the node's VNode had a ref function, invoke it with null here.
		// (this is part of the React spec, and smart for unsetting references)
		if (node[ATTR_KEY]!=null && node[ATTR_KEY].ref) node[ATTR_KEY].ref(null);

		if (unmountOnly===false || node[ATTR_KEY]==null) {
			removeNode(node);
		}

		removeChildren(node);
	}
}


/** Recollect/unmount all children.
 *	- we use .lastChild here because it causes less reflow than .firstChild
 *	- it's also cheaper than accessing the .childNodes Live NodeList
 */
function removeChildren(node) {
	node = node.lastChild;
	while (node) {
		let next = node.previousSibling;
		recollectNodeTree(node, true);
		node = next;
	}
}


/** Apply differences in attributes from a VNode to the given DOM Element.
 *	@param {Element} dom		Element with attributes to diff `attrs` against
 *	@param {Object} attrs		The desired end-state key-value attribute pairs
 *	@param {Object} old			Current/previous attributes (from previous VNode or element's prop cache)
 */
function diffAttributes(dom, attrs, old) {
	let name;

	// remove attributes no longer present on the vnode by setting them to undefined
	for (name in old) {
		if (!(attrs && attrs[name]!=null) && old[name]!=null) {
			setAccessor(dom, name, old[name], old[name] = undefined, isSvgMode);
		}
	}

	// add new & update changed attributes
	for (name in attrs) {
		if (name!=='children' && name!=='innerHTML' && (!(name in old) || attrs[name]!==(name==='value' || name==='checked' ? dom[name] : old[name]))) {
			setAccessor(dom, name, old[name], old[name] = attrs[name], isSvgMode);
		}
	}
}

/** Retains a pool of Components for re-use, keyed on component name.
 *	Note: since component names are not unique or even necessarily available, these are primarily a form of sharding.
 *	@private
 */
const components = {};


/** Reclaim a component for later re-use by the recycler. */
function collectComponent(component) {
	let name = component.constructor.name;
	(components[name] || (components[name] = [])).push(component);
}


/** Create a component. Normalizes differences between PFC's and classful Components. */
function createComponent(Ctor, props, context) {
	let list = components[Ctor.name],
		inst;

	if (Ctor.prototype && Ctor.prototype.render) {
		inst = new Ctor(props, context);
		Component.call(inst, props, context);
	}
	else {
		inst = new Component(props, context);
		inst.constructor = Ctor;
		inst.render = doRender;
	}


	if (list) {
		for (let i=list.length; i--; ) {
			if (list[i].constructor===Ctor) {
				inst.nextBase = list[i].nextBase;
				list.splice(i, 1);
				break;
			}
		}
	}
	return inst;
}


/** The `.render()` method for a PFC backing instance. */
function doRender(props, state, context) {
	return this.constructor(props, context);
}

/** Set a component's `props` (generally derived from JSX attributes).
 *	@param {Object} props
 *	@param {Object} [opts]
 *	@param {boolean} [opts.renderSync=false]	If `true` and {@link options.syncComponentUpdates} is `true`, triggers synchronous rendering.
 *	@param {boolean} [opts.render=true]			If `false`, no render will be triggered.
 */
function setComponentProps(component, props, opts, context, mountAll) {
	if (component._disable) return;
	component._disable = true;

	if ((component.__ref = props.ref)) delete props.ref;
	if ((component.__key = props.key)) delete props.key;

	if (!component.base || mountAll) {
		if (component.componentWillMount) component.componentWillMount();
	}
	else if (component.componentWillReceiveProps) {
		component.componentWillReceiveProps(props, context);
	}

	if (context && context!==component.context) {
		if (!component.prevContext) component.prevContext = component.context;
		component.context = context;
	}

	if (!component.prevProps) component.prevProps = component.props;
	component.props = props;

	component._disable = false;

	if (opts!==NO_RENDER) {
		if (opts===SYNC_RENDER || options.syncComponentUpdates!==false || !component.base) {
			renderComponent(component, SYNC_RENDER, mountAll);
		}
		else {
			enqueueRender(component);
		}
	}

	if (component.__ref) component.__ref(component);
}



/** Render a Component, triggering necessary lifecycle events and taking High-Order Components into account.
 *	@param {Component} component
 *	@param {Object} [opts]
 *	@param {boolean} [opts.build=false]		If `true`, component will build and store a DOM node if not already associated with one.
 *	@private
 */
function renderComponent(component, opts, mountAll, isChild) {
	if (component._disable) return;

	let props = component.props,
		state = component.state,
		context = component.context,
		previousProps = component.prevProps || props,
		previousState = component.prevState || state,
		previousContext = component.prevContext || context,
		isUpdate = component.base,
		nextBase = component.nextBase,
		initialBase = isUpdate || nextBase,
		initialChildComponent = component._component,
		skip = false,
		rendered, inst, cbase;

	// if updating
	if (isUpdate) {
		component.props = previousProps;
		component.state = previousState;
		component.context = previousContext;
		if (opts!==FORCE_RENDER
			&& component.shouldComponentUpdate
			&& component.shouldComponentUpdate(props, state, context) === false) {
			skip = true;
		}
		else if (component.componentWillUpdate) {
			component.componentWillUpdate(props, state, context);
		}
		component.props = props;
		component.state = state;
		component.context = context;
	}

	component.prevProps = component.prevState = component.prevContext = component.nextBase = null;
	component._dirty = false;

	if (!skip) {
		rendered = component.render(props, state, context);

		// context to pass to the child, can be updated via (grand-)parent component
		if (component.getChildContext) {
			context = extend(extend({}, context), component.getChildContext());
		}

		let childComponent = rendered && rendered.nodeName,
			toUnmount, base;

		if (typeof childComponent==='function') {
			// set up high order component link

			let childProps = getNodeProps(rendered);
			inst = initialChildComponent;

			if (inst && inst.constructor===childComponent && childProps.key==inst.__key) {
				setComponentProps(inst, childProps, SYNC_RENDER, context, false);
			}
			else {
				toUnmount = inst;

				component._component = inst = createComponent(childComponent, childProps, context);
				inst.nextBase = inst.nextBase || nextBase;
				inst._parentComponent = component;
				setComponentProps(inst, childProps, NO_RENDER, context, false);
				renderComponent(inst, SYNC_RENDER, mountAll, true);
			}

			base = inst.base;
		}
		else {
			cbase = initialBase;

			// destroy high order component link
			toUnmount = initialChildComponent;
			if (toUnmount) {
				cbase = component._component = null;
			}

			if (initialBase || opts===SYNC_RENDER) {
				if (cbase) cbase._component = null;
				base = diff(cbase, rendered, context, mountAll || !isUpdate, initialBase && initialBase.parentNode, true);
			}
		}

		if (initialBase && base!==initialBase && inst!==initialChildComponent) {
			let baseParent = initialBase.parentNode;
			if (baseParent && base!==baseParent) {
				baseParent.replaceChild(base, initialBase);

				if (!toUnmount) {
					initialBase._component = null;
					recollectNodeTree(initialBase, false);
				}
			}
		}

		if (toUnmount) {
			unmountComponent(toUnmount);
		}

		component.base = base;
		if (base && !isChild) {
			let componentRef = component,
				t = component;
			while ((t=t._parentComponent)) {
				(componentRef = t).base = base;
			}
			base._component = componentRef;
			base._componentConstructor = componentRef.constructor;
		}
	}

	if (!isUpdate || mountAll) {
		mounts.unshift(component);
	}
	else if (!skip) {
		// Ensure that pending componentDidMount() hooks of child components
		// are called before the componentDidUpdate() hook in the parent.
		flushMounts();

		if (component.componentDidUpdate) {
			component.componentDidUpdate(previousProps, previousState, previousContext);
		}
		if (options.afterUpdate) options.afterUpdate(component);
	}

	if (component._renderCallbacks!=null) {
		while (component._renderCallbacks.length) component._renderCallbacks.pop().call(component);
	}

	if (!diffLevel && !isChild) flushMounts();
}



/** Apply the Component referenced by a VNode to the DOM.
 *	@param {Element} dom	The DOM node to mutate
 *	@param {VNode} vnode	A Component-referencing VNode
 *	@returns {Element} dom	The created/mutated element
 *	@private
 */
function buildComponentFromVNode(dom, vnode, context, mountAll) {
	let c = dom && dom._component,
		originalComponent = c,
		oldDom = dom,
		isDirectOwner = c && dom._componentConstructor===vnode.nodeName,
		isOwner = isDirectOwner,
		props = getNodeProps(vnode);
	while (c && !isOwner && (c=c._parentComponent)) {
		isOwner = c.constructor===vnode.nodeName;
	}

	if (c && isOwner && (!mountAll || c._component)) {
		setComponentProps(c, props, ASYNC_RENDER, context, mountAll);
		dom = c.base;
	}
	else {
		if (originalComponent && !isDirectOwner) {
			unmountComponent(originalComponent);
			dom = oldDom = null;
		}

		c = createComponent(vnode.nodeName, props, context);
		if (dom && !c.nextBase) {
			c.nextBase = dom;
			// passing dom/oldDom as nextBase will recycle it if unused, so bypass recycling on L229:
			oldDom = null;
		}
		setComponentProps(c, props, SYNC_RENDER, context, mountAll);
		dom = c.base;

		if (oldDom && dom!==oldDom) {
			oldDom._component = null;
			recollectNodeTree(oldDom, false);
		}
	}

	return dom;
}



/** Remove a component from the DOM and recycle it.
 *	@param {Component} component	The Component instance to unmount
 *	@private
 */
function unmountComponent(component) {
	if (options.beforeUnmount) options.beforeUnmount(component);

	let base = component.base;

	component._disable = true;

	if (component.componentWillUnmount) component.componentWillUnmount();

	component.base = null;

	// recursively tear down & recollect high-order component children:
	let inner = component._component;
	if (inner) {
		unmountComponent(inner);
	}
	else if (base) {
		if (base[ATTR_KEY] && base[ATTR_KEY].ref) base[ATTR_KEY].ref(null);

		component.nextBase = base;

		removeNode(base);
		collectComponent(component);

		removeChildren(base);
	}

	if (component.__ref) component.__ref(null);
}

/** Base Component class.
 *	Provides `setState()` and `forceUpdate()`, which trigger rendering.
 *	@public
 *
 *	@example
 *	class MyFoo extends Component {
 *		render(props, state) {
 *			return <div />;
 *		}
 *	}
 */
function Component(props, context) {
	this._dirty = true;

	/** @public
	 *	@type {object}
	 */
	this.context = context;

	/** @public
	 *	@type {object}
	 */
	this.props = props;

	/** @public
	 *	@type {object}
	 */
	this.state = this.state || {};
}


extend(Component.prototype, {

	/** Returns a `boolean` indicating if the component should re-render when receiving the given `props` and `state`.
	 *	@param {object} nextProps
	 *	@param {object} nextState
	 *	@param {object} nextContext
	 *	@returns {Boolean} should the component re-render
	 *	@name shouldComponentUpdate
	 *	@function
	 */


	/** Update component state by copying properties from `state` to `this.state`.
	 *	@param {object} state		A hash of state properties to update with new values
	 *	@param {function} callback	A function to be called once component state is updated
	 */
	setState(state, callback) {
		let s = this.state;
		if (!this.prevState) this.prevState = extend({}, s);
		extend(s, typeof state==='function' ? state(s, this.props) : state);
		if (callback) (this._renderCallbacks = (this._renderCallbacks || [])).push(callback);
		enqueueRender(this);
	},


	/** Immediately perform a synchronous re-render of the component.
	 *	@param {function} callback		A function to be called after component is re-rendered.
	 *	@private
	 */
	forceUpdate(callback) {
		if (callback) (this._renderCallbacks = (this._renderCallbacks || [])).push(callback);
		renderComponent(this, FORCE_RENDER);
	},


	/** Accepts `props` and `state`, and returns a new Virtual DOM tree to build.
	 *	Virtual DOM is generally constructed via [JSX](http://jasonformat.com/wtf-is-jsx).
	 *	@param {object} props		Props (eg: JSX attributes) received from parent element/component
	 *	@param {object} state		The component's current state
	 *	@param {object} context		Context object (if a parent component has provided context)
	 *	@returns VNode
	 */
	render() {}

});

/** Render JSX into a `parent` Element.
 *	@param {VNode} vnode		A (JSX) VNode to render
 *	@param {Element} parent		DOM element to render into
 *	@param {Element} [merge]	Attempt to re-use an existing DOM tree rooted at `merge`
 *	@public
 *
 *	@example
 *	// render a div into <body>:
 *	render(<div id="hello">hello!</div>, document.body);
 *
 *	@example
 *	// render a "Thing" component into #foo:
 *	const Thing = ({ name }) => <span>{ name }</span>;
 *	render(<Thing name="one" />, document.querySelector('#foo'));
 */
function render(vnode, parent, merge) {
	return diff(merge, vnode, {}, false, parent, false);
}

let ar = 4 / 3;

function resize() {
    const html = document.documentElement,
          w = html.clientWidth,
          h = html.clientHeight,
          landscape = w / h > ar,
          width = landscape ? Math.floor(h * ar) : w,
          height = landscape ? h : Math.floor(w / ar);
    if (w) {
        html.style.fontSize = height / 100 + 'px';
        html.style.display = "none";
        //            html.clientWidth; // Force relayout - important to new Android devices
        html.style.display = "";
    }
    document.body.style.cssText = `margin-top: ${-height / 2}px; margin-left: ${-width / 2}px; width: ${width}px; height: ${height}px;`;
}

window.addEventListener('resize', resize);
resize();

/** Virtual DOM Node */
function VNode$1() {}

/** Global options
 *	@public
 *	@namespace options {Object}
 */
var options$1 = {

	/** If `true`, `prop` changes trigger synchronous component updates.
  *	@name syncComponentUpdates
  *	@type Boolean
  *	@default true
  */
	//syncComponentUpdates: true,

	/** Processes all created VNodes.
  *	@param {VNode} vnode	A newly-created VNode to normalize/process
  */
	//vnode(vnode) { }

	/** Hook invoked after a component is mounted. */
	// afterMount(component) { }

	/** Hook invoked after the DOM is updated with a component's latest render. */
	// afterUpdate(component) { }

	/** Hook invoked immediately before a component is unmounted. */
	// beforeUnmount(component) { }
};

const stack$1 = [];

const EMPTY_CHILDREN$1 = [];

/** JSX/hyperscript reviver
*	Benchmarks: https://esbench.com/bench/57ee8f8e330ab09900a1a1a0
 *	@see http://jasonformat.com/wtf-is-jsx
 *	@public
 */
function h$1(nodeName, attributes) {
	let children = EMPTY_CHILDREN$1,
	    lastSimple,
	    child,
	    simple,
	    i;
	for (i = arguments.length; i-- > 2;) {
		stack$1.push(arguments[i]);
	}
	if (attributes && attributes.children != null) {
		if (!stack$1.length) stack$1.push(attributes.children);
		delete attributes.children;
	}
	while (stack$1.length) {
		if ((child = stack$1.pop()) && child.pop !== undefined) {
			for (i = child.length; i--;) stack$1.push(child[i]);
		} else {
			if (child === true || child === false) child = null;

			if (simple = typeof nodeName !== 'function') {
				if (child == null) child = '';else if (typeof child === 'number') child = String(child);else if (typeof child !== 'string') simple = false;
			}

			if (simple && lastSimple) {
				children[children.length - 1] += child;
			} else if (children === EMPTY_CHILDREN$1) {
				children = [child];
			} else {
				children.push(child);
			}

			lastSimple = simple;
		}
	}

	let p = new VNode$1();
	p.nodeName = nodeName;
	p.children = children;
	p.attributes = attributes == null ? undefined : attributes;
	p.key = attributes == null ? undefined : attributes.key;

	// if a "vnode hook" is defined, pass every created VNode to it
	if (options$1.vnode !== undefined) options$1.vnode(p);

	return p;
}

/** Copy own-properties from `props` onto `obj`.
 *	@returns obj
 *	@private
 */
function extend$1(obj, props) {
  for (let i in props) obj[i] = props[i];
  return obj;
}

// render modes

const NO_RENDER$1 = 0;
const SYNC_RENDER$1 = 1;
const FORCE_RENDER$1 = 2;
const ASYNC_RENDER$1 = 3;

const ATTR_KEY$1 = '__preactattr_';

// DOM properties that should NOT have "px" added when numeric
const IS_NON_DIMENSIONAL$1 = /acit|ex(?:s|g|n|p|$)|rph|ows|mnc|ntw|ine[ch]|zoo|^ord/i;

/** Managed queue of dirty components to be re-rendered */

let items$1 = [];

function enqueueRender$1(component) {
	if (!component._dirty && (component._dirty = true) && items$1.push(component) == 1) {
		(options$1.debounceRendering || setTimeout)(rerender$1);
	}
}

function rerender$1() {
	let p,
	    list = items$1;
	items$1 = [];
	while (p = list.pop()) {
		if (p._dirty) renderComponent$1(p);
	}
}

/** Check if two nodes are equivalent.
 *	@param {Element} node
 *	@param {VNode} vnode
 *	@private
 */
function isSameNodeType$1(node, vnode, hydrating) {
	if (typeof vnode === 'string' || typeof vnode === 'number') {
		return node.splitText !== undefined;
	}
	if (typeof vnode.nodeName === 'string') {
		return !node._componentConstructor && isNamedNode$1(node, vnode.nodeName);
	}
	return hydrating || node._componentConstructor === vnode.nodeName;
}

/** Check if an Element has a given normalized name.
*	@param {Element} node
*	@param {String} nodeName
 */
function isNamedNode$1(node, nodeName) {
	return node.normalizedNodeName === nodeName || node.nodeName.toLowerCase() === nodeName.toLowerCase();
}

/**
 * Reconstruct Component-style `props` from a VNode.
 * Ensures default/fallback values from `defaultProps`:
 * Own-properties of `defaultProps` not present in `vnode.attributes` are added.
 * @param {VNode} vnode
 * @returns {Object} props
 */
function getNodeProps$1(vnode) {
	let props = extend$1({}, vnode.attributes);
	props.children = vnode.children;

	let defaultProps = vnode.nodeName.defaultProps;
	if (defaultProps !== undefined) {
		for (let i in defaultProps) {
			if (props[i] === undefined) {
				props[i] = defaultProps[i];
			}
		}
	}

	return props;
}

/** Create an element with the given nodeName.
 *	@param {String} nodeName
 *	@param {Boolean} [isSvg=false]	If `true`, creates an element within the SVG namespace.
 *	@returns {Element} node
 */
function createNode$1(nodeName, isSvg) {
	let node = isSvg ? document.createElementNS('http://www.w3.org/2000/svg', nodeName) : document.createElement(nodeName);
	node.normalizedNodeName = nodeName;
	return node;
}

/** Remove a child node from its parent if attached.
 *	@param {Element} node		The node to remove
 */
function removeNode$1(node) {
	if (node.parentNode) node.parentNode.removeChild(node);
}

/** Set a named attribute on the given Node, with special behavior for some names and event handlers.
 *	If `value` is `null`, the attribute/handler will be removed.
 *	@param {Element} node	An element to mutate
 *	@param {string} name	The name/key to set, such as an event or attribute name
 *	@param {any} old	The last value that was set for this name/node pair
 *	@param {any} value	An attribute value, such as a function to be used as an event handler
 *	@param {Boolean} isSvg	Are we currently diffing inside an svg?
 *	@private
 */
function setAccessor$1(node, name, old, value, isSvg) {
	if (name === 'className') name = 'class';

	if (name === 'key') {
		// ignore
	} else if (name === 'ref') {
		if (old) old(null);
		if (value) value(node);
	} else if (name === 'class' && !isSvg) {
		node.className = value || '';
	} else if (name === 'style') {
		if (!value || typeof value === 'string' || typeof old === 'string') {
			node.style.cssText = value || '';
		}
		if (value && typeof value === 'object') {
			if (typeof old !== 'string') {
				for (let i in old) if (!(i in value)) node.style[i] = '';
			}
			for (let i in value) {
				node.style[i] = typeof value[i] === 'number' && IS_NON_DIMENSIONAL$1.test(i) === false ? value[i] + 'px' : value[i];
			}
		}
	} else if (name === 'dangerouslySetInnerHTML') {
		if (value) node.innerHTML = value.__html || '';
	} else if (name[0] == 'o' && name[1] == 'n') {
		let useCapture = name !== (name = name.replace(/Capture$/, ''));
		name = name.toLowerCase().substring(2);
		if (value) {
			if (!old) node.addEventListener(name, eventProxy$1, useCapture);
		} else {
			node.removeEventListener(name, eventProxy$1, useCapture);
		}
		(node._listeners || (node._listeners = {}))[name] = value;
	} else if (name !== 'list' && name !== 'type' && !isSvg && name in node) {
		setProperty$1(node, name, value == null ? '' : value);
		if (value == null || value === false) node.removeAttribute(name);
	} else {
		let ns = isSvg && name !== (name = name.replace(/^xlink\:?/, ''));
		if (value == null || value === false) {
			if (ns) node.removeAttributeNS('http://www.w3.org/1999/xlink', name.toLowerCase());else node.removeAttribute(name);
		} else if (typeof value !== 'function') {
			if (ns) node.setAttributeNS('http://www.w3.org/1999/xlink', name.toLowerCase(), value);else node.setAttribute(name, value);
		}
	}
}

/** Attempt to set a DOM property to the given value.
 *	IE & FF throw for certain property-value combinations.
 */
function setProperty$1(node, name, value) {
	try {
		node[name] = value;
	} catch (e) {}
}

/** Proxy an event to hooked event handlers
 *	@private
 */
function eventProxy$1(e) {
	return this._listeners[e.type](options$1.event && options$1.event(e) || e);
}

/** Queue of components that have been mounted and are awaiting componentDidMount */
const mounts$1 = [];

/** Diff recursion count, used to track the end of the diff cycle. */
let diffLevel$1 = 0;

/** Global flag indicating if the diff is currently within an SVG */
let isSvgMode$1 = false;

/** Global flag indicating if the diff is performing hydration */
let hydrating$1 = false;

/** Invoke queued componentDidMount lifecycle methods */
function flushMounts$1() {
	let c;
	while (c = mounts$1.pop()) {
		if (options$1.afterMount) options$1.afterMount(c);
		if (c.componentDidMount) c.componentDidMount();
	}
}

/** Apply differences in a given vnode (and it's deep children) to a real DOM Node.
 *	@param {Element} [dom=null]		A DOM node to mutate into the shape of the `vnode`
 *	@param {VNode} vnode			A VNode (with descendants forming a tree) representing the desired DOM structure
 *	@returns {Element} dom			The created/mutated element
 *	@private
 */
function diff$1(dom, vnode, context, mountAll, parent, componentRoot) {
	// diffLevel having been 0 here indicates initial entry into the diff (not a subdiff)
	if (!diffLevel$1++) {
		// when first starting the diff, check if we're diffing an SVG or within an SVG
		isSvgMode$1 = parent != null && parent.ownerSVGElement !== undefined;

		// hydration is inidicated by the existing element to be diffed not having a prop cache
		hydrating$1 = dom != null && !(ATTR_KEY$1 in dom);
	}

	let ret = idiff$1(dom, vnode, context, mountAll, componentRoot);

	// append the element if its a new parent
	if (parent && ret.parentNode !== parent) parent.appendChild(ret);

	// diffLevel being reduced to 0 means we're exiting the diff
	if (! --diffLevel$1) {
		hydrating$1 = false;
		// invoke queued componentDidMount lifecycle methods
		if (!componentRoot) flushMounts$1();
	}

	return ret;
}

/** Internals of `diff()`, separated to allow bypassing diffLevel / mount flushing. */
function idiff$1(dom, vnode, context, mountAll, componentRoot) {
	let out = dom,
	    prevSvgMode = isSvgMode$1;

	// empty values (null & undefined) render as empty Text nodes
	if (vnode == null) vnode = '';

	// Fast case: Strings create/update Text nodes.
	if (typeof vnode === 'string') {

		// update if it's already a Text node:
		if (dom && dom.splitText !== undefined && dom.parentNode && (!dom._component || componentRoot)) {
			if (dom.nodeValue != vnode) {
				dom.nodeValue = vnode;
			}
		} else {
			// it wasn't a Text node: replace it with one and recycle the old Element
			out = document.createTextNode(vnode);
			if (dom) {
				if (dom.parentNode) dom.parentNode.replaceChild(out, dom);
				recollectNodeTree$1(dom, true);
			}
		}

		out[ATTR_KEY$1] = true;

		return out;
	}

	// If the VNode represents a Component, perform a component diff:
	if (typeof vnode.nodeName === 'function') {
		return buildComponentFromVNode$1(dom, vnode, context, mountAll);
	}

	// Tracks entering and exiting SVG namespace when descending through the tree.
	isSvgMode$1 = vnode.nodeName === 'svg' ? true : vnode.nodeName === 'foreignObject' ? false : isSvgMode$1;

	// If there's no existing element or it's the wrong type, create a new one:
	if (!dom || !isNamedNode$1(dom, String(vnode.nodeName))) {
		out = createNode$1(String(vnode.nodeName), isSvgMode$1);

		if (dom) {
			// move children into the replacement node
			while (dom.firstChild) out.appendChild(dom.firstChild);

			// if the previous Element was mounted into the DOM, replace it inline
			if (dom.parentNode) dom.parentNode.replaceChild(out, dom);

			// recycle the old element (skips non-Element node types)
			recollectNodeTree$1(dom, true);
		}
	}

	let fc = out.firstChild,
	    props = out[ATTR_KEY$1] || (out[ATTR_KEY$1] = {}),
	    vchildren = vnode.children;

	// Optimization: fast-path for elements containing a single TextNode:
	if (!hydrating$1 && vchildren && vchildren.length === 1 && typeof vchildren[0] === 'string' && fc != null && fc.splitText !== undefined && fc.nextSibling == null) {
		if (fc.nodeValue != vchildren[0]) {
			fc.nodeValue = vchildren[0];
		}
	}
	// otherwise, if there are existing or new children, diff them:
	else if (vchildren && vchildren.length || fc != null) {
			innerDiffNode$1(out, vchildren, context, mountAll, hydrating$1 || props.dangerouslySetInnerHTML != null);
		}

	// Apply attributes/props from VNode to the DOM Element:
	diffAttributes$1(out, vnode.attributes, props);

	// restore previous SVG mode: (in case we're exiting an SVG namespace)
	isSvgMode$1 = prevSvgMode;

	return out;
}

/** Apply child and attribute changes between a VNode and a DOM Node to the DOM.
 *	@param {Element} dom			Element whose children should be compared & mutated
 *	@param {Array} vchildren		Array of VNodes to compare to `dom.childNodes`
 *	@param {Object} context			Implicitly descendant context object (from most recent `getChildContext()`)
 *	@param {Boolean} mountAll
 *	@param {Boolean} isHydrating	If `true`, consumes externally created elements similar to hydration
 */
function innerDiffNode$1(dom, vchildren, context, mountAll, isHydrating) {
	let originalChildren = dom.childNodes,
	    children = [],
	    keyed = {},
	    keyedLen = 0,
	    min = 0,
	    len = originalChildren.length,
	    childrenLen = 0,
	    vlen = vchildren ? vchildren.length : 0,
	    j,
	    c,
	    vchild,
	    child;

	// Build up a map of keyed children and an Array of unkeyed children:
	if (len !== 0) {
		for (let i = 0; i < len; i++) {
			let child = originalChildren[i],
			    props = child[ATTR_KEY$1],
			    key = vlen && props ? child._component ? child._component.__key : props.key : null;
			if (key != null) {
				keyedLen++;
				keyed[key] = child;
			} else if (props || (child.splitText !== undefined ? isHydrating ? child.nodeValue.trim() : true : isHydrating)) {
				children[childrenLen++] = child;
			}
		}
	}

	if (vlen !== 0) {
		for (let i = 0; i < vlen; i++) {
			vchild = vchildren[i];
			child = null;

			// attempt to find a node based on key matching
			let key = vchild.key;
			if (key != null) {
				if (keyedLen && keyed[key] !== undefined) {
					child = keyed[key];
					keyed[key] = undefined;
					keyedLen--;
				}
			}
			// attempt to pluck a node of the same type from the existing children
			else if (!child && min < childrenLen) {
					for (j = min; j < childrenLen; j++) {
						if (children[j] !== undefined && isSameNodeType$1(c = children[j], vchild, isHydrating)) {
							child = c;
							children[j] = undefined;
							if (j === childrenLen - 1) childrenLen--;
							if (j === min) min++;
							break;
						}
					}
				}

			// morph the matched/found/created DOM child to match vchild (deep)
			child = idiff$1(child, vchild, context, mountAll);

			if (child && child !== dom) {
				if (i >= len) {
					dom.appendChild(child);
				} else if (child !== originalChildren[i]) {
					if (child === originalChildren[i + 1]) {
						removeNode$1(originalChildren[i]);
					} else {
						dom.insertBefore(child, originalChildren[i] || null);
					}
				}
			}
		}
	}

	// remove unused keyed children:
	if (keyedLen) {
		for (let i in keyed) if (keyed[i] !== undefined) recollectNodeTree$1(keyed[i], false);
	}

	// remove orphaned unkeyed children:
	while (min <= childrenLen) {
		if ((child = children[childrenLen--]) !== undefined) recollectNodeTree$1(child, false);
	}
}

/** Recursively recycle (or just unmount) a node an its descendants.
 *	@param {Node} node						DOM node to start unmount/removal from
 *	@param {Boolean} [unmountOnly=false]	If `true`, only triggers unmount lifecycle, skips removal
 */
function recollectNodeTree$1(node, unmountOnly) {
	let component = node._component;
	if (component) {
		// if node is owned by a Component, unmount that component (ends up recursing back here)
		unmountComponent$1(component);
	} else {
		// If the node's VNode had a ref function, invoke it with null here.
		// (this is part of the React spec, and smart for unsetting references)
		if (node[ATTR_KEY$1] != null && node[ATTR_KEY$1].ref) node[ATTR_KEY$1].ref(null);

		if (unmountOnly === false || node[ATTR_KEY$1] == null) {
			removeNode$1(node);
		}

		removeChildren$1(node);
	}
}

/** Recollect/unmount all children.
 *	- we use .lastChild here because it causes less reflow than .firstChild
 *	- it's also cheaper than accessing the .childNodes Live NodeList
 */
function removeChildren$1(node) {
	node = node.lastChild;
	while (node) {
		let next = node.previousSibling;
		recollectNodeTree$1(node, true);
		node = next;
	}
}

/** Apply differences in attributes from a VNode to the given DOM Element.
 *	@param {Element} dom		Element with attributes to diff `attrs` against
 *	@param {Object} attrs		The desired end-state key-value attribute pairs
 *	@param {Object} old			Current/previous attributes (from previous VNode or element's prop cache)
 */
function diffAttributes$1(dom, attrs, old) {
	let name;

	// remove attributes no longer present on the vnode by setting them to undefined
	for (name in old) {
		if (!(attrs && attrs[name] != null) && old[name] != null) {
			setAccessor$1(dom, name, old[name], old[name] = undefined, isSvgMode$1);
		}
	}

	// add new & update changed attributes
	for (name in attrs) {
		if (name !== 'children' && name !== 'innerHTML' && (!(name in old) || attrs[name] !== (name === 'value' || name === 'checked' ? dom[name] : old[name]))) {
			setAccessor$1(dom, name, old[name], old[name] = attrs[name], isSvgMode$1);
		}
	}
}

/** Retains a pool of Components for re-use, keyed on component name.
 *	Note: since component names are not unique or even necessarily available, these are primarily a form of sharding.
 *	@private
 */
const components$1 = {};

/** Reclaim a component for later re-use by the recycler. */
function collectComponent$1(component) {
	let name = component.constructor.name;
	(components$1[name] || (components$1[name] = [])).push(component);
}

/** Create a component. Normalizes differences between PFC's and classful Components. */
function createComponent$1(Ctor, props, context) {
	let list = components$1[Ctor.name],
	    inst;

	if (Ctor.prototype && Ctor.prototype.render) {
		inst = new Ctor(props, context);
		Component$1.call(inst, props, context);
	} else {
		inst = new Component$1(props, context);
		inst.constructor = Ctor;
		inst.render = doRender$1;
	}

	if (list) {
		for (let i = list.length; i--;) {
			if (list[i].constructor === Ctor) {
				inst.nextBase = list[i].nextBase;
				list.splice(i, 1);
				break;
			}
		}
	}
	return inst;
}

/** The `.render()` method for a PFC backing instance. */
function doRender$1(props, state, context) {
	return this.constructor(props, context);
}

/** Set a component's `props` (generally derived from JSX attributes).
 *	@param {Object} props
 *	@param {Object} [opts]
 *	@param {boolean} [opts.renderSync=false]	If `true` and {@link options.syncComponentUpdates} is `true`, triggers synchronous rendering.
 *	@param {boolean} [opts.render=true]			If `false`, no render will be triggered.
 */
function setComponentProps$1(component, props, opts, context, mountAll) {
	if (component._disable) return;
	component._disable = true;

	if (component.__ref = props.ref) delete props.ref;
	if (component.__key = props.key) delete props.key;

	if (!component.base || mountAll) {
		if (component.componentWillMount) component.componentWillMount();
	} else if (component.componentWillReceiveProps) {
		component.componentWillReceiveProps(props, context);
	}

	if (context && context !== component.context) {
		if (!component.prevContext) component.prevContext = component.context;
		component.context = context;
	}

	if (!component.prevProps) component.prevProps = component.props;
	component.props = props;

	component._disable = false;

	if (opts !== NO_RENDER$1) {
		if (opts === SYNC_RENDER$1 || options$1.syncComponentUpdates !== false || !component.base) {
			renderComponent$1(component, SYNC_RENDER$1, mountAll);
		} else {
			enqueueRender$1(component);
		}
	}

	if (component.__ref) component.__ref(component);
}

/** Render a Component, triggering necessary lifecycle events and taking High-Order Components into account.
 *	@param {Component} component
 *	@param {Object} [opts]
 *	@param {boolean} [opts.build=false]		If `true`, component will build and store a DOM node if not already associated with one.
 *	@private
 */
function renderComponent$1(component, opts, mountAll, isChild) {
	if (component._disable) return;

	let props = component.props,
	    state = component.state,
	    context = component.context,
	    previousProps = component.prevProps || props,
	    previousState = component.prevState || state,
	    previousContext = component.prevContext || context,
	    isUpdate = component.base,
	    nextBase = component.nextBase,
	    initialBase = isUpdate || nextBase,
	    initialChildComponent = component._component,
	    skip = false,
	    rendered,
	    inst,
	    cbase;

	// if updating
	if (isUpdate) {
		component.props = previousProps;
		component.state = previousState;
		component.context = previousContext;
		if (opts !== FORCE_RENDER$1 && component.shouldComponentUpdate && component.shouldComponentUpdate(props, state, context) === false) {
			skip = true;
		} else if (component.componentWillUpdate) {
			component.componentWillUpdate(props, state, context);
		}
		component.props = props;
		component.state = state;
		component.context = context;
	}

	component.prevProps = component.prevState = component.prevContext = component.nextBase = null;
	component._dirty = false;

	if (!skip) {
		rendered = component.render(props, state, context);

		// context to pass to the child, can be updated via (grand-)parent component
		if (component.getChildContext) {
			context = extend$1(extend$1({}, context), component.getChildContext());
		}

		let childComponent = rendered && rendered.nodeName,
		    toUnmount,
		    base;

		if (typeof childComponent === 'function') {
			// set up high order component link

			let childProps = getNodeProps$1(rendered);
			inst = initialChildComponent;

			if (inst && inst.constructor === childComponent && childProps.key == inst.__key) {
				setComponentProps$1(inst, childProps, SYNC_RENDER$1, context, false);
			} else {
				toUnmount = inst;

				component._component = inst = createComponent$1(childComponent, childProps, context);
				inst.nextBase = inst.nextBase || nextBase;
				inst._parentComponent = component;
				setComponentProps$1(inst, childProps, NO_RENDER$1, context, false);
				renderComponent$1(inst, SYNC_RENDER$1, mountAll, true);
			}

			base = inst.base;
		} else {
			cbase = initialBase;

			// destroy high order component link
			toUnmount = initialChildComponent;
			if (toUnmount) {
				cbase = component._component = null;
			}

			if (initialBase || opts === SYNC_RENDER$1) {
				if (cbase) cbase._component = null;
				base = diff$1(cbase, rendered, context, mountAll || !isUpdate, initialBase && initialBase.parentNode, true);
			}
		}

		if (initialBase && base !== initialBase && inst !== initialChildComponent) {
			let baseParent = initialBase.parentNode;
			if (baseParent && base !== baseParent) {
				baseParent.replaceChild(base, initialBase);

				if (!toUnmount) {
					initialBase._component = null;
					recollectNodeTree$1(initialBase, false);
				}
			}
		}

		if (toUnmount) {
			unmountComponent$1(toUnmount);
		}

		component.base = base;
		if (base && !isChild) {
			let componentRef = component,
			    t = component;
			while (t = t._parentComponent) {
				(componentRef = t).base = base;
			}
			base._component = componentRef;
			base._componentConstructor = componentRef.constructor;
		}
	}

	if (!isUpdate || mountAll) {
		mounts$1.unshift(component);
	} else if (!skip) {
		// Ensure that pending componentDidMount() hooks of child components
		// are called before the componentDidUpdate() hook in the parent.
		flushMounts$1();

		if (component.componentDidUpdate) {
			component.componentDidUpdate(previousProps, previousState, previousContext);
		}
		if (options$1.afterUpdate) options$1.afterUpdate(component);
	}

	if (component._renderCallbacks != null) {
		while (component._renderCallbacks.length) component._renderCallbacks.pop().call(component);
	}

	if (!diffLevel$1 && !isChild) flushMounts$1();
}

/** Apply the Component referenced by a VNode to the DOM.
 *	@param {Element} dom	The DOM node to mutate
 *	@param {VNode} vnode	A Component-referencing VNode
 *	@returns {Element} dom	The created/mutated element
 *	@private
 */
function buildComponentFromVNode$1(dom, vnode, context, mountAll) {
	let c = dom && dom._component,
	    originalComponent = c,
	    oldDom = dom,
	    isDirectOwner = c && dom._componentConstructor === vnode.nodeName,
	    isOwner = isDirectOwner,
	    props = getNodeProps$1(vnode);
	while (c && !isOwner && (c = c._parentComponent)) {
		isOwner = c.constructor === vnode.nodeName;
	}

	if (c && isOwner && (!mountAll || c._component)) {
		setComponentProps$1(c, props, ASYNC_RENDER$1, context, mountAll);
		dom = c.base;
	} else {
		if (originalComponent && !isDirectOwner) {
			unmountComponent$1(originalComponent);
			dom = oldDom = null;
		}

		c = createComponent$1(vnode.nodeName, props, context);
		if (dom && !c.nextBase) {
			c.nextBase = dom;
			// passing dom/oldDom as nextBase will recycle it if unused, so bypass recycling on L229:
			oldDom = null;
		}
		setComponentProps$1(c, props, SYNC_RENDER$1, context, mountAll);
		dom = c.base;

		if (oldDom && dom !== oldDom) {
			oldDom._component = null;
			recollectNodeTree$1(oldDom, false);
		}
	}

	return dom;
}

/** Remove a component from the DOM and recycle it.
 *	@param {Component} component	The Component instance to unmount
 *	@private
 */
function unmountComponent$1(component) {
	if (options$1.beforeUnmount) options$1.beforeUnmount(component);

	let base = component.base;

	component._disable = true;

	if (component.componentWillUnmount) component.componentWillUnmount();

	component.base = null;

	// recursively tear down & recollect high-order component children:
	let inner = component._component;
	if (inner) {
		unmountComponent$1(inner);
	} else if (base) {
		if (base[ATTR_KEY$1] && base[ATTR_KEY$1].ref) base[ATTR_KEY$1].ref(null);

		component.nextBase = base;

		removeNode$1(base);
		collectComponent$1(component);

		removeChildren$1(base);
	}

	if (component.__ref) component.__ref(null);
}

/** Base Component class.
 *	Provides `setState()` and `forceUpdate()`, which trigger rendering.
 *	@public
 *
 *	@example
 *	class MyFoo extends Component {
 *		render(props, state) {
 *			return <div />;
 *		}
 *	}
 */
function Component$1(props, context) {
	this._dirty = true;

	/** @public
  *	@type {object}
  */
	this.context = context;

	/** @public
  *	@type {object}
  */
	this.props = props;

	/** @public
  *	@type {object}
  */
	this.state = this.state || {};
}

extend$1(Component$1.prototype, {

	/** Returns a `boolean` indicating if the component should re-render when receiving the given `props` and `state`.
  *	@param {object} nextProps
  *	@param {object} nextState
  *	@param {object} nextContext
  *	@returns {Boolean} should the component re-render
  *	@name shouldComponentUpdate
  *	@function
  */

	/** Update component state by copying properties from `state` to `this.state`.
  *	@param {object} state		A hash of state properties to update with new values
  *	@param {function} callback	A function to be called once component state is updated
  */
	setState(state, callback) {
		let s = this.state;
		if (!this.prevState) this.prevState = extend$1({}, s);
		extend$1(s, typeof state === 'function' ? state(s, this.props) : state);
		if (callback) (this._renderCallbacks = this._renderCallbacks || []).push(callback);
		enqueueRender$1(this);
	},

	/** Immediately perform a synchronous re-render of the component.
  *	@param {function} callback		A function to be called after component is re-rendered.
  *	@private
  */
	forceUpdate(callback) {
		if (callback) (this._renderCallbacks = this._renderCallbacks || []).push(callback);
		renderComponent$1(this, FORCE_RENDER$1);
	},

	/** Accepts `props` and `state`, and returns a new Virtual DOM tree to build.
  *	Virtual DOM is generally constructed via [JSX](http://jasonformat.com/wtf-is-jsx).
  *	@param {object} props		Props (eg: JSX attributes) received from parent element/component
  *	@param {object} state		The component's current state
  *	@param {object} context		Context object (if a parent component has provided context)
  *	@returns VNode
  */
	render() {}

});

/** Render JSX into a `parent` Element.
 *	@param {VNode} vnode		A (JSX) VNode to render
 *	@param {Element} parent		DOM element to render into
 *	@param {Element} [merge]	Attempt to re-use an existing DOM tree rooted at `merge`
 *	@public
 *
 *	@example
 *	// render a div into <body>:
 *	render(<div id="hello">hello!</div>, document.body);
 *
 *	@example
 *	// render a "Thing" component into #foo:
 *	const Thing = ({ name }) => <span>{ name }</span>;
 *	render(<Thing name="one" />, document.querySelector('#foo'));
 */

__$styleInject("@font-face {\n  font-family: 'Alegreya Sans SC';\n  font-style: normal;\n  font-weight: 400;\n  src: url(\"/res/alegreyasanssc.ttf\");\n}\nhtml {\n  box-sizing: border-box;\n}\n*,\n*:before,\n*:after {\n  box-sizing: inherit;\n  padding: 0;\n  margin: 0;\n}\n._container_11dlz_17 {\n  position: absolute;\n  width: 100%;\n  height: 100%;\n  padding: 0 2.666666666666667rem;\n}\n._row_11dlz_23 {\n  margin: 0 -2.666666666666667rem;\n}\n._row_11dlz_23:after {\n  content: \"\";\n  display: table;\n  clear: both;\n}\n._col_11dlz_31 {\n  float: left;\n  padding: 1rem 2rem;\n}\n._inset_11dlz_35 {\n  background-color: rgba(33,33,33,0.8);\n  position: absolute;\n  top: 0rem;\n  height: 100rem;\n  left: 13.333333333333332rem;\n  width: 106.66666666666666rem;\n  overflow-y: auto !important;\n}\n._inset_11dlz_35 #_icon-cross_11dlz_1 {\n  position: absolute;\n  top: 0;\n  right: 0;\n}\n::-webkit-scrollbar {\n  width: 4rem;\n}\n::-webkit-scrollbar-track {\n  background-color: transparent;\n}\n::-webkit-scrollbar-thumb {\n  background-color: #ffc107;\n  border-radius: 2rem;\n}\n._icon_11dlz_59 {\n  display: inline-block;\n  line-height: 0;\n}\n._icon_11dlz_59 svg {\n  fill: currentColor;\n  vertical-align: middle;\n}\n._icon_11dlz_59:not(._small_11dlz_67) svg {\n  width: 9rem;\n  height: 9rem;\n}\n._icon_11dlz_59._small_11dlz_67 svg {\n  width: 6rem;\n  height: 6rem;\n}\n.__flat_1r4gm_1_11dlz_75 {\n  display: flex;\n  height: 10.8rem;\n  text-align: center;\n  flex-direction: row;\n  align-items: center;\n  justify-content: center;\n  border: 0;\n  outline: none;\n  font-size: 8rem;\n  font-family: Alegreya Sans SC;\n  text-transform: uppercase;\n  min-width: 27rem;\n  padding: 0 2.4rem;\n  border-radius: 0.6rem;\n  background: transparent;\n}\n.__raised_1r4gm_18_11dlz_92 {\n  display: flex;\n  height: 10.8rem;\n  text-align: center;\n  flex-direction: row;\n  align-items: center;\n  justify-content: center;\n  border: 0;\n  outline: none;\n  font-size: 8rem;\n  font-family: Alegreya Sans SC;\n  text-transform: uppercase;\n  min-width: 27rem;\n  padding: 0 2.4rem;\n  border-radius: 0.6rem;\n  box-shadow: 0 2rem 2rem 0 rgba(0,0,0,0.14), 0 3rem 1rem -2rem rgba(0,0,0,0.2), 0 1rem 5rem 0 rgba(0,0,0,0.12);\n}\n.__raised_1r4gm_18_11dlz_92:active {\n  box-shadow: 0 4rem 5rem rgba(0,0,0,0.14), 0 1rem 10rem rgba(0,0,0,0.12), 0 2rem 4rem -1rem rgba(0,0,0,0.2);\n}\n.__raised_1r4gm_18_11dlz_92:focus:not(:active) {\n  box-shadow: 0 0 4rem rgba(0,0,0,0.18), 0 4rem 8rem rgba(0,0,0,0.36);\n}\n.__raised_1r4gm_18_11dlz_92.__inverse_1r4gm_41_11dlz_115:active {\n  box-shadow: 0 4rem 5rem rgba(255,255,255,0.14), 0 1rem 10rem rgba(0,0,0,0.12);\n}\n.__raised_1r4gm_18_11dlz_92.__inverse_1r4gm_41_11dlz_115:focus:not(:active) {\n  box-shadow: 0 0 4rem rgba(255,255,255,0.18), 0 4rem 8rem rgba(0,0,0,0.36);\n}\n.__raised_1r4gm_18_11dlz_92.__inverse_1r4gm_41_11dlz_115 {\n  box-shadow: 0 1rem 1rem 0 rgba(255,255,255,0.3), 0 1rem 5rem 0 rgba(0,0,0,0.1);\n}\n.__floating_1r4gm_50_11dlz_124 {\n  display: flex;\n  height: 10.8rem;\n  text-align: center;\n  flex-direction: row;\n  align-items: center;\n  justify-content: center;\n  border: 0;\n  outline: none;\n  font-size: 8rem;\n  font-family: Alegreya Sans SC;\n  text-transform: uppercase;\n  border-radius: 50%;\n  box-shadow: 0 1rem 1.5rem 0 rgba(0,0,0,0.12), 0 1rem 1rem 0 rgba(0,0,0,0.24);\n  width: 15.899999999999999rem;\n  height: 15.899999999999999rem;\n}\n.__floating_1r4gm_50_11dlz_124:active {\n  box-shadow: 0 4rem 5rem rgba(0,0,0,0.14), 0 1rem 10rem rgba(0,0,0,0.12), 0 2rem 4rem -1rem rgba(0,0,0,0.2);\n}\n.__floating_1r4gm_50_11dlz_124:focus:not(:active) {\n  box-shadow: 0 0 4rem rgba(0,0,0,0.18), 0 4rem 8rem rgba(0,0,0,0.36);\n}\n.__floating_1r4gm_50_11dlz_124.__inverse_1r4gm_41_11dlz_115:active {\n  box-shadow: 0 4rem 5rem rgba(255,255,255,0.14), 0 1rem 10rem rgba(0,0,0,0.12);\n}\n.__floating_1r4gm_50_11dlz_124.__inverse_1r4gm_41_11dlz_115:focus:not(:active) {\n  box-shadow: 0 0 4rem rgba(255,255,255,0.18), 0 4rem 8rem rgba(0,0,0,0.36);\n}\n.__floating_1r4gm_50_11dlz_124.__inverse_1r4gm_41_11dlz_115 {\n  box-shadow: 0 1rem 1rem 0 rgba(255,255,255,0.4), 0 1rem 1rem 0 rgba(0,0,0,0.4);\n}\n.__floating_1r4gm_50_11dlz_124 .__icon_1r4gm_82_11dlz_156 {\n  display: inline-block;\n}\n.__floating_1r4gm_50_11dlz_124.__mini_1r4gm_85_11dlz_159 {\n  width: 10.8rem;\n  height: 10.8rem;\n}\n.__floating_1r4gm_50_11dlz_124.__mini_1r4gm_85_11dlz_159 .__icon_1r4gm_82_11dlz_156 {\n  display: inline-block;\n}\n.__neutral_1r4gm_92_11dlz_166.__raised_1r4gm_18_11dlz_92,\n.__neutral_1r4gm_92_11dlz_166.__floating_1r4gm_50_11dlz_124 {\n  color: #212121;\n  background: #fff;\n}\n.__neutral_1r4gm_92_11dlz_166.__flat_1r4gm_1_11dlz_75 {\n  color: #212121;\n  background: transparent;\n}\n.__neutral_1r4gm_92_11dlz_166.__flat_1r4gm_1_11dlz_75:hover {\n  background: rgba(117,117,117,0.6);\n}\n.__neutral_1r4gm_92_11dlz_166.__inverse_1r4gm_41_11dlz_115.__raised_1r4gm_18_11dlz_92,\n.__neutral_1r4gm_92_11dlz_166.__inverse_1r4gm_41_11dlz_115.__floating_1r4gm_50_11dlz_124 {\n  color: #fff;\n  background: #212121;\n}\n.__neutral_1r4gm_92_11dlz_166.__inverse_1r4gm_41_11dlz_115.__flat_1r4gm_1_11dlz_75 {\n  color: #fff;\n}\n.__neutral_1r4gm_92_11dlz_166.__inverse_1r4gm_41_11dlz_115.__flat_1r4gm_1_11dlz_75:hover {\n  background: rgba(117,117,117,0.6);\n}\n.__primary_1r4gm_115_11dlz_189.__raised_1r4gm_18_11dlz_92,\n.__primary_1r4gm_115_11dlz_189.__floating_1r4gm_50_11dlz_124 {\n  color: #fff;\n  background: #607d8b;\n}\n.__primary_1r4gm_115_11dlz_189.__flat_1r4gm_1_11dlz_75 {\n  color: #607d8b;\n}\n.__primary_1r4gm_115_11dlz_189.__flat_1r4gm_1_11dlz_75:hover {\n  background: rgba(144,164,174,0.5);\n}\n.__primary_1r4gm_115_11dlz_189.__inverse_1r4gm_41_11dlz_115.__flat_1r4gm_1_11dlz_75 {\n  color: #90a4ae;\n}\n.__accent_1r4gm_129_11dlz_203.__raised_1r4gm_18_11dlz_92,\n.__accent_1r4gm_129_11dlz_203.__floating_1r4gm_50_11dlz_124 {\n  color: #000;\n  background: #ffc107;\n}\n.__accent_1r4gm_129_11dlz_203.__flat_1r4gm_1_11dlz_75 {\n  color: #ffc107;\n}\n.__accent_1r4gm_129_11dlz_203.__flat_1r4gm_1_11dlz_75:hover {\n  background: rgba(255,193,7,0.3);\n}\n.__rippleWrapper_vr0w5_1_11dlz_214 {\n  position: absolute;\n  top: 0;\n  right: 0;\n  bottom: 0;\n  left: 0;\n  z-index: 1;\n  pointer-events: none;\n}\n.__ripple_vr0w5_1_11dlz_223 {\n  position: absolute;\n  top: 50%;\n  left: 50%;\n  z-index: 100;\n  pointer-events: none;\n  background-color: currentColor;\n  border-radius: 50%;\n  transform-origin: 50% 50%;\n  transition-duration: 800ms;\n}\n.__ripple_vr0w5_1_11dlz_223.__rippleRestarting_vr0w5_21_11dlz_234 {\n  opacity: 0.3;\n  transition-property: none;\n}\n.__ripple_vr0w5_1_11dlz_223.__rippleActive_vr0w5_25_11dlz_238 {\n  opacity: 0.3;\n  transition-property: transform;\n}\n.__ripple_vr0w5_1_11dlz_223:not(.__rippleActive_vr0w5_25_11dlz_238):not(.__rippleRestarting_vr0w5_21_11dlz_234) {\n  opacity: 0;\n  transition-property: opacity, transform;\n}\n.__field_432t5_1_11dlz_246 {\n  position: relative;\n  display: block;\n  height: auto;\n  white-space: nowrap;\n  vertical-align: middle;\n}\n.__thumb_432t5_8_11dlz_253 {\n  transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);\n  transition-duration: 0.2s;\n  position: absolute;\n  top: -0.72rem;\n  width: 4.8rem;\n  height: 4.8rem;\n  cursor: pointer;\n  border-radius: 50%;\n  transition-property: left;\n}\n.__thumb_432t5_8_11dlz_253 .__ripple_432t5_19_11dlz_264 {\n  transition-duration: 550ms;\n}\n.__on_432t5_22_11dlz_267 {\n  position: relative;\n  display: inline-block;\n  width: 9.12rem;\n  height: 3.36rem;\n  margin-top: 1.2rem;\n  vertical-align: top;\n  cursor: pointer;\n  border-radius: 4rem;\n  background: rgba(255,193,7,0.5);\n}\n.__on_432t5_22_11dlz_267 .__thumb_432t5_8_11dlz_253 {\n  left: 4.319999999999999rem;\n  background: #ffc107;\n}\n.__off_432t5_37_11dlz_282 {\n  position: relative;\n  display: inline-block;\n  width: 9.12rem;\n  height: 3.36rem;\n  margin-top: 1.2rem;\n  vertical-align: top;\n  cursor: pointer;\n  border-radius: 4rem;\n  background: #fefefe;\n}\n.__off_432t5_37_11dlz_282 .__thumb_432t5_8_11dlz_253 {\n  left: 0;\n  background: #fafafa;\n}\n\n", { "container": "_container_11dlz_17", "row": "_row_11dlz_23", "col": "_col_11dlz_31", "inset": "_inset_11dlz_35", "icon-cross": "_icon-cross_11dlz_1", "icon": "_icon_11dlz_59", "small": "_small_11dlz_67", "_flat_1r4gm_1": "__flat_1r4gm_1_11dlz_75", "_raised_1r4gm_18": "__raised_1r4gm_18_11dlz_92", "_inverse_1r4gm_41": "__inverse_1r4gm_41_11dlz_115", "_floating_1r4gm_50": "__floating_1r4gm_50_11dlz_124", "_icon_1r4gm_82": "__icon_1r4gm_82_11dlz_156", "_mini_1r4gm_85": "__mini_1r4gm_85_11dlz_159", "_neutral_1r4gm_92": "__neutral_1r4gm_92_11dlz_166", "_primary_1r4gm_115": "__primary_1r4gm_115_11dlz_189", "_accent_1r4gm_129": "__accent_1r4gm_129_11dlz_203", "_rippleWrapper_vr0w5_1": "__rippleWrapper_vr0w5_1_11dlz_214", "_ripple_vr0w5_1": "__ripple_vr0w5_1_11dlz_223", "_rippleRestarting_vr0w5_21": "__rippleRestarting_vr0w5_21_11dlz_234", "_rippleActive_vr0w5_25": "__rippleActive_vr0w5_25_11dlz_238", "_field_432t5_1": "__field_432t5_1_11dlz_246", "_thumb_432t5_8": "__thumb_432t5_8_11dlz_253", "_ripple_432t5_19": "__ripple_432t5_19_11dlz_264", "_on_432t5_22": "__on_432t5_22_11dlz_267", "_off_432t5_37": "__off_432t5_37_11dlz_282" });

/** Virtual DOM Node */
function VNode$2(nodeName, attributes, children) {
	/** @type {string|function} */
	this.nodeName = nodeName;

	/** @type {object<string>|undefined} */
	this.attributes = attributes;

	/** @type {array<VNode>|undefined} */
	this.children = children;

	/** Reference to the given key. */
	this.key = attributes && attributes.key;
}

/** Global options
 *	@public
 *	@namespace options {Object}
 */
var options$2 = {

	/** If `true`, `prop` changes trigger synchronous component updates.
  *	@name syncComponentUpdates
  *	@type Boolean
  *	@default true
  */
	//syncComponentUpdates: true,

	/** Processes all created VNodes.
  *	@param {VNode} vnode	A newly-created VNode to normalize/process
  */
	//vnode(vnode) { }

	/** Hook invoked after a component is mounted. */
	// afterMount(component) { }

	/** Hook invoked after the DOM is updated with a component's latest render. */
	// afterUpdate(component) { }

	/** Hook invoked immediately before a component is unmounted. */
	// beforeUnmount(component) { }
};

const stack$3 = [];

/** JSX/hyperscript reviver
*	Benchmarks: https://esbench.com/bench/57ee8f8e330ab09900a1a1a0
 *	@see http://jasonformat.com/wtf-is-jsx
 *	@public
 *  @example
 *  /** @jsx h *\/
 *  import { render, h } from 'preact';
 *  render(<span>foo</span>, document.body);
 */
function h$2(nodeName, attributes) {
	let children = [],
	    lastSimple,
	    child,
	    simple,
	    i;
	for (i = arguments.length; i-- > 2;) {
		stack$3.push(arguments[i]);
	}
	if (attributes && attributes.children) {
		if (!stack$3.length) stack$3.push(attributes.children);
		delete attributes.children;
	}
	while (stack$3.length) {
		if ((child = stack$3.pop()) instanceof Array) {
			for (i = child.length; i--;) stack$3.push(child[i]);
		} else if (child != null && child !== false) {
			if (typeof child == 'number' || child === true) child = String(child);
			simple = typeof child == 'string';
			if (simple && lastSimple) {
				children[children.length - 1] += child;
			} else {
				children.push(child);
				lastSimple = simple;
			}
		}
	}

	let p = new VNode$2(nodeName, attributes || undefined, children);

	// if a "vnode hook" is defined, pass every created VNode to it
	if (options$2.vnode) options$2.vnode(p);

	return p;
}

/** Copy own-properties from `props` onto `obj`.
 *	@returns obj
 *	@private
 */
function extend$2(obj, props) {
	if (props) {
		for (let i in props) obj[i] = props[i];
	}
	return obj;
}

/** Fast clone. Note: does not filter out non-own properties.
 *	@see https://esbench.com/bench/56baa34f45df6895002e03b6
 */
function clone(obj) {
	return extend$2({}, obj);
}

/** Get a deep property value from the given object, expressed in dot-notation.
 *	@private
 */
function delve(obj, key) {
	for (let p = key.split('.'), i = 0; i < p.length && obj; i++) {
		obj = obj[p[i]];
	}
	return obj;
}

/** @private is the given object a Function? */
function isFunction(obj) {
	return 'function' === typeof obj;
}

/** @private is the given object a String? */
function isString(obj) {
	return 'string' === typeof obj;
}

/** Convert a hashmap of CSS classes to a space-delimited className string
 *	@private
 */
function hashToClassName(c) {
	let str = '';
	for (let prop in c) {
		if (c[prop]) {
			if (str) str += ' ';
			str += prop;
		}
	}
	return str;
}

/** Just a memoized String#toLowerCase */
let lcCache = {};
const toLowerCase = s => lcCache[s] || (lcCache[s] = s.toLowerCase());

/** Call a function asynchronously, as soon as possible.
 *	@param {Function} callback
 */
let resolved = typeof Promise !== 'undefined' && Promise.resolve();
const defer = resolved ? f => {
	resolved.then(f);
} : setTimeout;

// render modes

const NO_RENDER$2 = 0;
const SYNC_RENDER$2 = 1;
const FORCE_RENDER$2 = 2;
const ASYNC_RENDER$2 = 3;

const EMPTY = {};

const ATTR_KEY$2 = typeof Symbol !== 'undefined' ? Symbol.for('preactattr') : '__preactattr_';

// DOM properties that should NOT have "px" added when numeric
const NON_DIMENSION_PROPS = {
	boxFlex: 1, boxFlexGroup: 1, columnCount: 1, fillOpacity: 1, flex: 1, flexGrow: 1,
	flexPositive: 1, flexShrink: 1, flexNegative: 1, fontWeight: 1, lineClamp: 1, lineHeight: 1,
	opacity: 1, order: 1, orphans: 1, strokeOpacity: 1, widows: 1, zIndex: 1, zoom: 1
};

// DOM event types that do not bubble and should be attached via useCapture
const NON_BUBBLING_EVENTS = { blur: 1, error: 1, focus: 1, load: 1, resize: 1, scroll: 1 };

/** Create an Event handler function that sets a given state property.
 *	@param {Component} component	The component whose state should be updated
 *	@param {string} key				A dot-notated key path to update in the component's state
 *	@param {string} eventPath		A dot-notated key path to the value that should be retrieved from the Event or component
 *	@returns {function} linkedStateHandler
 *	@private
 */
function createLinkedState(component, key, eventPath) {
	let path = key.split('.');
	return function (e) {
		let t = e && e.target || this,
		    state = {},
		    obj = state,
		    v = isString(eventPath) ? delve(e, eventPath) : t.nodeName ? t.type.match(/^che|rad/) ? t.checked : t.value : e,
		    i = 0;
		for (; i < path.length - 1; i++) {
			obj = obj[path[i]] || (obj[path[i]] = !i && component.state[path[i]] || {});
		}
		obj[path[i]] = v;
		component.setState(state);
	};
}

/** Managed queue of dirty components to be re-rendered */

// items/itemsOffline swap on each rerender() call (just a simple pool technique)
let items$2 = [];

function enqueueRender$2(component) {
	if (!component._dirty && (component._dirty = true) && items$2.push(component) == 1) {
		(options$2.debounceRendering || defer)(rerender$2);
	}
}

function rerender$2() {
	let p,
	    list = items$2;
	items$2 = [];
	while (p = list.pop()) {
		if (p._dirty) renderComponent$2(p);
	}
}

/** Check if a VNode is a reference to a stateless functional component.
 *	A function component is represented as a VNode whose `nodeName` property is a reference to a function.
 *	If that function is not a Component (ie, has no `.render()` method on a prototype), it is considered a stateless functional component.
 *	@param {VNode} vnode	A VNode
 *	@private
 */
function isFunctionalComponent(vnode) {
  let nodeName = vnode && vnode.nodeName;
  return nodeName && isFunction(nodeName) && !(nodeName.prototype && nodeName.prototype.render);
}

/** Construct a resultant VNode from a VNode referencing a stateless functional component.
 *	@param {VNode} vnode	A VNode with a `nodeName` property that is a reference to a function.
 *	@private
 */
function buildFunctionalComponent(vnode, context) {
  return vnode.nodeName(getNodeProps$2(vnode), context || EMPTY);
}

/** Check if two nodes are equivalent.
 *	@param {Element} node
 *	@param {VNode} vnode
 *	@private
 */
function isSameNodeType$2(node, vnode) {
	if (isString(vnode)) {
		return node instanceof Text;
	}
	if (isString(vnode.nodeName)) {
		return isNamedNode$2(node, vnode.nodeName);
	}
	if (isFunction(vnode.nodeName)) {
		return node._componentConstructor === vnode.nodeName || isFunctionalComponent(vnode);
	}
}

function isNamedNode$2(node, nodeName) {
	return node.normalizedNodeName === nodeName || toLowerCase(node.nodeName) === toLowerCase(nodeName);
}

/**
 * Reconstruct Component-style `props` from a VNode.
 * Ensures default/fallback values from `defaultProps`:
 * Own-properties of `defaultProps` not present in `vnode.attributes` are added.
 * @param {VNode} vnode
 * @returns {Object} props
 */
function getNodeProps$2(vnode) {
	let props = clone(vnode.attributes);
	props.children = vnode.children;

	let defaultProps = vnode.nodeName.defaultProps;
	if (defaultProps) {
		for (let i in defaultProps) {
			if (props[i] === undefined) {
				props[i] = defaultProps[i];
			}
		}
	}

	return props;
}

/** Removes a given DOM Node from its parent. */
function removeNode$2(node) {
	let p = node.parentNode;
	if (p) p.removeChild(node);
}

/** Set a named attribute on the given Node, with special behavior for some names and event handlers.
 *	If `value` is `null`, the attribute/handler will be removed.
 *	@param {Element} node	An element to mutate
 *	@param {string} name	The name/key to set, such as an event or attribute name
 *	@param {any} value		An attribute value, such as a function to be used as an event handler
 *	@param {any} previousValue	The last value that was set for this name/node pair
 *	@private
 */
function setAccessor$2(node, name, old, value, isSvg) {

	if (name === 'className') name = 'class';

	if (name === 'class' && value && typeof value === 'object') {
		value = hashToClassName(value);
	}

	if (name === 'key') {
		// ignore
	} else if (name === 'class' && !isSvg) {
		node.className = value || '';
	} else if (name === 'style') {
		if (!value || isString(value) || isString(old)) {
			node.style.cssText = value || '';
		}
		if (value && typeof value === 'object') {
			if (!isString(old)) {
				for (let i in old) if (!(i in value)) node.style[i] = '';
			}
			for (let i in value) {
				node.style[i] = typeof value[i] === 'number' && !NON_DIMENSION_PROPS[i] ? value[i] + 'px' : value[i];
			}
		}
	} else if (name === 'dangerouslySetInnerHTML') {
		if (value) node.innerHTML = value.__html;
	} else if (name[0] == 'o' && name[1] == 'n') {
		let l = node._listeners || (node._listeners = {});
		name = toLowerCase(name.substring(2));
		// @TODO: this might be worth it later, un-breaks focus/blur bubbling in IE9:
		// if (node.attachEvent) name = name=='focus'?'focusin':name=='blur'?'focusout':name;
		if (value) {
			if (!l[name]) node.addEventListener(name, eventProxy$2, !!NON_BUBBLING_EVENTS[name]);
		} else if (l[name]) {
			node.removeEventListener(name, eventProxy$2, !!NON_BUBBLING_EVENTS[name]);
		}
		l[name] = value;
	} else if (name !== 'list' && name !== 'type' && !isSvg && name in node) {
		setProperty$2(node, name, value == null ? '' : value);
		if (value == null || value === false) node.removeAttribute(name);
	} else {
		let ns = isSvg && name.match(/^xlink\:?(.+)/);
		if (value == null || value === false) {
			if (ns) node.removeAttributeNS('http://www.w3.org/1999/xlink', toLowerCase(ns[1]));else node.removeAttribute(name);
		} else if (typeof value !== 'object' && !isFunction(value)) {
			if (ns) node.setAttributeNS('http://www.w3.org/1999/xlink', toLowerCase(ns[1]), value);else node.setAttribute(name, value);
		}
	}
}

/** Attempt to set a DOM property to the given value.
 *	IE & FF throw for certain property-value combinations.
 */
function setProperty$2(node, name, value) {
	try {
		node[name] = value;
	} catch (e) {}
}

/** Proxy an event to hooked event handlers
 *	@private
 */
function eventProxy$2(e) {
	return this._listeners[e.type](options$2.event && options$2.event(e) || e);
}

/** DOM node pool, keyed on nodeName. */

const nodes = {};

function collectNode(node) {
	removeNode$2(node);

	if (node instanceof Element) {
		node._component = node._componentConstructor = null;

		let name = node.normalizedNodeName || toLowerCase(node.nodeName);
		(nodes[name] || (nodes[name] = [])).push(node);
	}
}

function createNode$2(nodeName, isSvg) {
	let name = toLowerCase(nodeName),
	    node = nodes[name] && nodes[name].pop() || (isSvg ? document.createElementNS('http://www.w3.org/2000/svg', nodeName) : document.createElement(nodeName));
	node.normalizedNodeName = name;
	return node;
}

/** Diff recursion count, used to track the end of the diff cycle. */
const mounts$2 = [];

/** Diff recursion count, used to track the end of the diff cycle. */
let diffLevel$2 = 0;

let isSvgMode$2 = false;

function flushMounts$2() {
	let c;
	while (c = mounts$2.pop()) {
		if (options$2.afterMount) options$2.afterMount(c);
		if (c.componentDidMount) c.componentDidMount();
	}
}

/** Apply differences in a given vnode (and it's deep children) to a real DOM Node.
 *	@param {Element} [dom=null]		A DOM node to mutate into the shape of the `vnode`
 *	@param {VNode} vnode			A VNode (with descendants forming a tree) representing the desired DOM structure
 *	@returns {Element} dom			The created/mutated element
 *	@private
 */
function diff$2(dom, vnode, context, mountAll, parent, componentRoot) {
	if (!diffLevel$2++) isSvgMode$2 = parent instanceof SVGElement;
	let ret = idiff$2(dom, vnode, context, mountAll);
	if (parent && ret.parentNode !== parent) parent.appendChild(ret);
	if (! --diffLevel$2 && !componentRoot) flushMounts$2();
	return ret;
}

function idiff$2(dom, vnode, context, mountAll) {
	let originalAttributes = vnode && vnode.attributes;

	while (isFunctionalComponent(vnode)) {
		vnode = buildFunctionalComponent(vnode, context);
	}

	if (vnode == null) vnode = '';

	if (isString(vnode)) {
		if (dom) {
			if (dom instanceof Text && dom.parentNode) {
				if (dom.nodeValue != vnode) {
					dom.nodeValue = vnode;
				}
				return dom;
			}
			recollectNodeTree$2(dom);
		}
		return document.createTextNode(vnode);
	}

	if (isFunction(vnode.nodeName)) {
		return buildComponentFromVNode$2(dom, vnode, context, mountAll);
	}

	let out = dom,
	    nodeName = vnode.nodeName,
	    prevSvgMode = isSvgMode$2,
	    vchildren = vnode.children;

	if (!isString(nodeName)) {
		nodeName = String(nodeName);
	}

	isSvgMode$2 = nodeName === 'svg' ? true : nodeName === 'foreignObject' ? false : isSvgMode$2;

	if (!dom) {
		out = createNode$2(nodeName, isSvgMode$2);
	} else if (!isNamedNode$2(dom, nodeName)) {
		out = createNode$2(nodeName, isSvgMode$2);
		// move children into the replacement node
		while (dom.firstChild) out.appendChild(dom.firstChild);
		// reclaim element nodes
		recollectNodeTree$2(dom);
	}

	// fast-path for elements containing a single TextNode:
	if (vchildren && vchildren.length === 1 && typeof vchildren[0] === 'string' && out.childNodes.length === 1 && out.firstChild instanceof Text) {
		if (out.firstChild.nodeValue != vchildren[0]) {
			out.firstChild.nodeValue = vchildren[0];
		}
	} else if (vchildren && vchildren.length || out.firstChild) {
		innerDiffNode$2(out, vchildren, context, mountAll);
	}

	let props = out[ATTR_KEY$2];
	if (!props) {
		out[ATTR_KEY$2] = props = {};
		for (let a = out.attributes, i = a.length; i--;) props[a[i].name] = a[i].value;
	}

	diffAttributes$2(out, vnode.attributes, props);

	if (originalAttributes && typeof originalAttributes.ref === 'function') {
		(props.ref = originalAttributes.ref)(out);
	}

	isSvgMode$2 = prevSvgMode;

	return out;
}

/** Apply child and attribute changes between a VNode and a DOM Node to the DOM. */
function innerDiffNode$2(dom, vchildren, context, mountAll) {
	let originalChildren = dom.childNodes,
	    children = [],
	    keyed = {},
	    keyedLen = 0,
	    min = 0,
	    len = originalChildren.length,
	    childrenLen = 0,
	    vlen = vchildren && vchildren.length,
	    j,
	    c,
	    vchild,
	    child;

	if (len) {
		for (let i = 0; i < len; i++) {
			let child = originalChildren[i],
			    key = vlen ? (c = child._component) ? c.__key : (c = child[ATTR_KEY$2]) ? c.key : null : null;
			if (key || key === 0) {
				keyedLen++;
				keyed[key] = child;
			} else {
				children[childrenLen++] = child;
			}
		}
	}

	if (vlen) {
		for (let i = 0; i < vlen; i++) {
			vchild = vchildren[i];
			child = null;

			// if (isFunctionalComponent(vchild)) {
			// 	vchild = buildFunctionalComponent(vchild);
			// }

			// attempt to find a node based on key matching
			let key = vchild.key;
			if (key != null) {
				if (keyedLen && key in keyed) {
					child = keyed[key];
					keyed[key] = undefined;
					keyedLen--;
				}
			}
			// attempt to pluck a node of the same type from the existing children
			else if (!child && min < childrenLen) {
					for (j = min; j < childrenLen; j++) {
						c = children[j];
						if (c && isSameNodeType$2(c, vchild)) {
							child = c;
							children[j] = undefined;
							if (j === childrenLen - 1) childrenLen--;
							if (j === min) min++;
							break;
						}
					}
					if (!child && min < childrenLen && isFunction(vchild.nodeName) && mountAll) {
						child = children[min];
						children[min++] = undefined;
					}
				}

			// morph the matched/found/created DOM child to match vchild (deep)
			child = idiff$2(child, vchild, context, mountAll);

			if (child && child !== dom && child !== originalChildren[i]) {
				dom.insertBefore(child, originalChildren[i] || null);
			}
		}
	}

	if (keyedLen) {
		for (let i in keyed) if (keyed[i]) recollectNodeTree$2(keyed[i]);
	}

	// remove orphaned children
	if (min < childrenLen) {
		removeOrphanedChildren(children);
	}
}

/** Reclaim children that were unreferenced in the desired VTree */
function removeOrphanedChildren(children, unmountOnly) {
	for (let i = children.length; i--;) {
		if (children[i]) {
			recollectNodeTree$2(children[i], unmountOnly);
		}
	}
}

/** Reclaim an entire tree of nodes, starting at the root. */
function recollectNodeTree$2(node, unmountOnly) {
	// @TODO: Need to make a call on whether Preact should remove nodes not created by itself.
	// Currently it *does* remove them. Discussion: https://github.com/developit/preact/issues/39
	//if (!node[ATTR_KEY]) return;

	let component = node._component;
	if (component) {
		unmountComponent$2(component, !unmountOnly);
	} else {
		if (node[ATTR_KEY$2] && node[ATTR_KEY$2].ref) node[ATTR_KEY$2].ref(null);

		if (!unmountOnly) {
			collectNode(node);
		}

		if (node.childNodes && node.childNodes.length) {
			removeOrphanedChildren(node.childNodes, unmountOnly);
		}
	}
}

/** Apply differences in attributes from a VNode to the given DOM Node. */
function diffAttributes$2(dom, attrs, old) {
	for (let name in old) {
		if (!(attrs && name in attrs) && old[name] != null) {
			setAccessor$2(dom, name, old[name], old[name] = undefined, isSvgMode$2);
		}
	}

	// new & updated
	if (attrs) {
		for (let name in attrs) {
			if (name !== 'children' && name !== 'innerHTML' && (!(name in old) || attrs[name] !== (name === 'value' || name === 'checked' ? dom[name] : old[name]))) {
				setAccessor$2(dom, name, old[name], old[name] = attrs[name], isSvgMode$2);
			}
		}
	}
}

/** Retains a pool of Components for re-use, keyed on component name.
 *	Note: since component names are not unique or even necessarily available, these are primarily a form of sharding.
 *	@private
 */
const components$3 = {};

function collectComponent$2(component) {
	let name = component.constructor.name,
	    list = components$3[name];
	if (list) list.push(component);else components$3[name] = [component];
}

function createComponent$2(Ctor, props, context) {
	let inst = new Ctor(props, context),
	    list = components$3[Ctor.name];
	Component$2.call(inst, props, context);
	if (list) {
		for (let i = list.length; i--;) {
			if (list[i].constructor === Ctor) {
				inst.nextBase = list[i].nextBase;
				list.splice(i, 1);
				break;
			}
		}
	}
	return inst;
}

/** Set a component's `props` (generally derived from JSX attributes).
 *	@param {Object} props
 *	@param {Object} [opts]
 *	@param {boolean} [opts.renderSync=false]	If `true` and {@link options.syncComponentUpdates} is `true`, triggers synchronous rendering.
 *	@param {boolean} [opts.render=true]			If `false`, no render will be triggered.
 */
function setComponentProps$2(component, props, opts, context, mountAll) {
	if (component._disable) return;
	component._disable = true;

	if (component.__ref = props.ref) delete props.ref;
	if (component.__key = props.key) delete props.key;

	if (!component.base || mountAll) {
		if (component.componentWillMount) component.componentWillMount();
	} else if (component.componentWillReceiveProps) {
		component.componentWillReceiveProps(props, context);
	}

	if (context && context !== component.context) {
		if (!component.prevContext) component.prevContext = component.context;
		component.context = context;
	}

	if (!component.prevProps) component.prevProps = component.props;
	component.props = props;

	component._disable = false;

	if (opts !== NO_RENDER$2) {
		if (opts === SYNC_RENDER$2 || options$2.syncComponentUpdates !== false || !component.base) {
			renderComponent$2(component, SYNC_RENDER$2, mountAll);
		} else {
			enqueueRender$2(component);
		}
	}

	if (component.__ref) component.__ref(component);
}

/** Render a Component, triggering necessary lifecycle events and taking High-Order Components into account.
 *	@param {Component} component
 *	@param {Object} [opts]
 *	@param {boolean} [opts.build=false]		If `true`, component will build and store a DOM node if not already associated with one.
 *	@private
 */
function renderComponent$2(component, opts, mountAll, isChild) {
	if (component._disable) return;

	let skip,
	    rendered,
	    props = component.props,
	    state = component.state,
	    context = component.context,
	    previousProps = component.prevProps || props,
	    previousState = component.prevState || state,
	    previousContext = component.prevContext || context,
	    isUpdate = component.base,
	    nextBase = component.nextBase,
	    initialBase = isUpdate || nextBase,
	    initialChildComponent = component._component,
	    inst,
	    cbase;

	// if updating
	if (isUpdate) {
		component.props = previousProps;
		component.state = previousState;
		component.context = previousContext;
		if (opts !== FORCE_RENDER$2 && component.shouldComponentUpdate && component.shouldComponentUpdate(props, state, context) === false) {
			skip = true;
		} else if (component.componentWillUpdate) {
			component.componentWillUpdate(props, state, context);
		}
		component.props = props;
		component.state = state;
		component.context = context;
	}

	component.prevProps = component.prevState = component.prevContext = component.nextBase = null;
	component._dirty = false;

	if (!skip) {
		if (component.render) rendered = component.render(props, state, context);

		// context to pass to the child, can be updated via (grand-)parent component
		if (component.getChildContext) {
			context = extend$2(clone(context), component.getChildContext());
		}

		while (isFunctionalComponent(rendered)) {
			rendered = buildFunctionalComponent(rendered, context);
		}

		let childComponent = rendered && rendered.nodeName,
		    toUnmount,
		    base;

		if (isFunction(childComponent)) {
			// set up high order component link


			inst = initialChildComponent;
			let childProps = getNodeProps$2(rendered);

			if (inst && inst.constructor === childComponent) {
				setComponentProps$2(inst, childProps, SYNC_RENDER$2, context);
			} else {
				toUnmount = inst;

				inst = createComponent$2(childComponent, childProps, context);
				inst.nextBase = inst.nextBase || nextBase;
				inst._parentComponent = component;
				component._component = inst;
				setComponentProps$2(inst, childProps, NO_RENDER$2, context);
				renderComponent$2(inst, SYNC_RENDER$2, mountAll, true);
			}

			base = inst.base;
		} else {
			cbase = initialBase;

			// destroy high order component link
			toUnmount = initialChildComponent;
			if (toUnmount) {
				cbase = component._component = null;
			}

			if (initialBase || opts === SYNC_RENDER$2) {
				if (cbase) cbase._component = null;
				base = diff$2(cbase, rendered, context, mountAll || !isUpdate, initialBase && initialBase.parentNode, true);
			}
		}

		if (initialBase && base !== initialBase && inst !== initialChildComponent) {
			let baseParent = initialBase.parentNode;
			if (baseParent && base !== baseParent) {
				baseParent.replaceChild(base, initialBase);

				if (!toUnmount) {
					initialBase._component = null;
					recollectNodeTree$2(initialBase);
				}
			}
		}

		if (toUnmount) {
			unmountComponent$2(toUnmount, base !== initialBase);
		}

		component.base = base;
		if (base && !isChild) {
			let componentRef = component,
			    t = component;
			while (t = t._parentComponent) {
				(componentRef = t).base = base;
			}
			base._component = componentRef;
			base._componentConstructor = componentRef.constructor;
		}
	}

	if (!isUpdate || mountAll) {
		mounts$2.unshift(component);
	} else if (!skip) {
		if (component.componentDidUpdate) {
			component.componentDidUpdate(previousProps, previousState, previousContext);
		}
		if (options$2.afterUpdate) options$2.afterUpdate(component);
	}

	let cb = component._renderCallbacks,
	    fn;
	if (cb) while (fn = cb.pop()) fn.call(component);

	if (!diffLevel$2 && !isChild) flushMounts$2();
}

/** Apply the Component referenced by a VNode to the DOM.
 *	@param {Element} dom	The DOM node to mutate
 *	@param {VNode} vnode	A Component-referencing VNode
 *	@returns {Element} dom	The created/mutated element
 *	@private
 */
function buildComponentFromVNode$2(dom, vnode, context, mountAll) {
	let c = dom && dom._component,
	    oldDom = dom,
	    isDirectOwner = c && dom._componentConstructor === vnode.nodeName,
	    isOwner = isDirectOwner,
	    props = getNodeProps$2(vnode);
	while (c && !isOwner && (c = c._parentComponent)) {
		isOwner = c.constructor === vnode.nodeName;
	}

	if (c && isOwner && (!mountAll || c._component)) {
		setComponentProps$2(c, props, ASYNC_RENDER$2, context, mountAll);
		dom = c.base;
	} else {
		if (c && !isDirectOwner) {
			unmountComponent$2(c, true);
			dom = oldDom = null;
		}

		c = createComponent$2(vnode.nodeName, props, context);
		if (dom && !c.nextBase) {
			c.nextBase = dom;
			// passing dom/oldDom as nextBase will recycle it if unused, so bypass recycling on L241:
			oldDom = null;
		}
		setComponentProps$2(c, props, SYNC_RENDER$2, context, mountAll);
		dom = c.base;

		if (oldDom && dom !== oldDom) {
			oldDom._component = null;
			recollectNodeTree$2(oldDom);
		}
	}

	return dom;
}

/** Remove a component from the DOM and recycle it.
 *	@param {Element} dom			A DOM node from which to unmount the given Component
 *	@param {Component} component	The Component instance to unmount
 *	@private
 */
function unmountComponent$2(component, remove) {
	if (options$2.beforeUnmount) options$2.beforeUnmount(component);

	// console.log(`${remove?'Removing':'Unmounting'} component: ${component.constructor.name}`);
	let base = component.base;

	component._disable = true;

	if (component.componentWillUnmount) component.componentWillUnmount();

	component.base = null;

	// recursively tear down & recollect high-order component children:
	let inner = component._component;
	if (inner) {
		unmountComponent$2(inner, remove);
	} else if (base) {
		if (base[ATTR_KEY$2] && base[ATTR_KEY$2].ref) base[ATTR_KEY$2].ref(null);

		component.nextBase = base;

		if (remove) {
			removeNode$2(base);
			collectComponent$2(component);
		}
		removeOrphanedChildren(base.childNodes, !remove);
	}

	if (component.__ref) component.__ref(null);
	if (component.componentDidUnmount) component.componentDidUnmount();
}

/** Base Component class, for he ES6 Class method of creating Components
 *	@public
 *
 *	@example
 *	class MyFoo extends Component {
 *		render(props, state) {
 *			return <div />;
 *		}
 *	}
 */
function Component$2(props, context) {
	/** @private */
	this._dirty = true;
	// /** @public */
	// this._disableRendering = false;
	// /** @public */
	// this.prevState = this.prevProps = this.prevContext = this.base = this.nextBase = this._parentComponent = this._component = this.__ref = this.__key = this._linkedStates = this._renderCallbacks = null;
	/** @public */
	this.context = context;
	/** @type {object} */
	this.props = props;
	/** @type {object} */
	if (!this.state) this.state = {};
}

extend$2(Component$2.prototype, {

	/** Returns a `boolean` value indicating if the component should re-render when receiving the given `props` and `state`.
  *	@param {object} nextProps
  *	@param {object} nextState
  *	@param {object} nextContext
  *	@returns {Boolean} should the component re-render
  *	@name shouldComponentUpdate
  *	@function
  */
	// shouldComponentUpdate() {
	// 	return true;
	// },


	/** Returns a function that sets a state property when called.
  *	Calling linkState() repeatedly with the same arguments returns a cached link function.
  *
  *	Provides some built-in special cases:
  *		- Checkboxes and radio buttons link their boolean `checked` value
  *		- Inputs automatically link their `value` property
  *		- Event paths fall back to any associated Component if not found on an element
  *		- If linked value is a function, will invoke it and use the result
  *
  *	@param {string} key				The path to set - can be a dot-notated deep key
  *	@param {string} [eventPath]		If set, attempts to find the new state value at a given dot-notated path within the object passed to the linkedState setter.
  *	@returns {function} linkStateSetter(e)
  *
  *	@example Update a "text" state value when an input changes:
  *		<input onChange={ this.linkState('text') } />
  *
  *	@example Set a deep state value on click
  *		<button onClick={ this.linkState('touch.coords', 'touches.0') }>Tap</button
  */
	linkState(key, eventPath) {
		let c = this._linkedStates || (this._linkedStates = {});
		return c[key + eventPath] || (c[key + eventPath] = createLinkedState(this, key, eventPath));
	},

	/** Update component state by copying properties from `state` to `this.state`.
  *	@param {object} state		A hash of state properties to update with new values
  */
	setState(state, callback) {
		let s = this.state;
		if (!this.prevState) this.prevState = clone(s);
		extend$2(s, isFunction(state) ? state(s, this.props) : state);
		if (callback) (this._renderCallbacks = this._renderCallbacks || []).push(callback);
		enqueueRender$2(this);
	},

	/** Immediately perform a synchronous re-render of the component.
  *	@private
  */
	forceUpdate() {
		renderComponent$2(this, FORCE_RENDER$2);
	},

	/** Accepts `props` and `state`, and returns a new Virtual DOM tree to build.
  *	Virtual DOM is generally constructed via [JSX](http://jasonformat.com/wtf-is-jsx).
  *	@param {object} props		Props (eg: JSX attributes) received from parent element/component
  *	@param {object} state		The component's current state
  *	@param {object} context		Context object (if a parent component has provided context)
  *	@returns VNode
  */
	render() {}

});

/** Render JSX into a `parent` Element.
 *	@param {VNode} vnode		A (JSX) VNode to render
 *	@param {Element} parent		DOM element to render into
 *	@param {Element} [merge]	Attempt to re-use an existing DOM tree rooted at `merge`
 *	@public
 *
 *	@example
 *	// render a div into <body>:
 *	render(<div id="hello">hello!</div>, document.body);
 *
 *	@example
 *	// render a "Thing" component into #foo:
 *	const Thing = ({ name }) => <span>{ name }</span>;
 *	render(<Thing name="one" />, document.querySelector('#foo'));
 */

/*
 Copyright (C) 2016-2017 Theatersoft

 This program is free software: you can redistribute it and/or modify it under
 the terms of the GNU Affero General Public License as published by the Free
 Software Foundation, version 3.

 This program is distributed in the hope that it will be useful, but WITHOUT
 ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
 FOR A PARTICULAR PURPOSE. See the GNU Affero General Public License for more
 details.

 You should have received a copy of the GNU Affero General Public License along
 with this program. If not, see <http://www.gnu.org/licenses/>
 */
class Base {}

function mixinEventEmitter(Base) {
    return class EventEmitter extends Base {
        constructor(...args) {
            super(...args);
            this.events /*: Map<Event, Array<Callback>>*/ = new Map();
        }

        // aka addListener
        on(type, callback) {
            this.events.has(type) || this.events.set(type, []);
            this.events.get(type).push(callback);
            return this;
        }

        // aka removeListener
        off(type, callback) {
            const callbacks = this.events.get(type);
            if (callbacks && callbacks.length) this.events.set(type, callbacks.filter(cb => cb !== callback));
        }

        emit(type, ...args) {
            const callbacks = this.events.get(type);
            if (callbacks && callbacks.length) {
                callbacks.forEach(cb => cb(...args));
                return true;
            }
            return false;
        }
    };
}

class EventEmitter extends mixinEventEmitter(Base) {}

const log$1 = console.log.bind(console);
const error$1 = console.error.bind(console);

const tag = 'BUS';
const format = (...args) => [tag, ...args];

const log$$1 = (...args) => log$1(...format(...args));
const error$$1 = (...args) => error$1(...format(...args));

function proxy(name) {
    let [, path, intf] = /^([/\d]+)(\w+)$/.exec(name) || [undefined, undefined, name];
    return new Proxy({}, {
        get(_, member) {
            return (...args) => (path ? Promise.resolve() : manager.resolveName(intf).then(p => {
                path = p;
            })).then(() => node.request({ path, intf, member, args }));
        }
    });
}

function methods(obj) {
    return Object.getOwnPropertyNames(Object.getPrototypeOf(obj)).filter(p => typeof obj[p] === 'function' && p !== 'constructor');
}

function parentStartup(ConnectionBase) {
    // fix TypeError in arrow function without braces returning a function
    // https://github.com/rollup/rollup/pull/1062
    return class extends ConnectionBase {
        constructor(...args) {
            super(...args);
            const { parent: { auth: AUTH } } = connection.context,
                  onhello = ({ hello }) => {
                if (hello) {
                    //log('parentStartup onhello', hello)
                    this.name = `${hello}0`;
                    this.emit('connect', hello);
                    this.off('data', onhello);
                }
            },
                  onauth = ({ auth }) => {
                //log('parentStartup onauth', auth)
                this.send({ auth: AUTH });
                this.off('data', onauth);
                this.on('data', onhello);
            };
            this.on('data', AUTH ? onauth : onhello);
            //log('parentStartup auth', AUTH)
        }
    };
}

class BrowserConnection extends EventEmitter {
    constructor(ws) {
        super();
        this.ws = ws;
        const self = this;
        ws.onopen = () => self.emit('open');
        ws.onmessage = ev => self.emit('data', JSON.parse(ev.data));
        ws.onclose = ev => {
            log$$1('connection close', this.name);
            self.emit('close');
        };
        ws.onerror = ev => self.emit('error', ev);
    }
    send(data) {
        //log.log(`connection ${this.name} send`, data)
        this.ws.send(JSON.stringify(data));
    }
}

class ParentConnection extends parentStartup(BrowserConnection) {}

let context;

var connection = {
    create(value = {}) {
        const { parent: { url = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}`, auth } = {} } = value;
        return Promise.resolve(auth).then(auth => {
            context = { parent: { url, auth } };
        });
    },

    get context() {
        if (!context) throw new Error('Invalid bus context');
        return context;
    },

    get hasParent() {
        return this.context.parent && this.context.parent.url;
    },

    get hasChildren() {
        return !!this.context.children;
    },

    createParentConnection() {
        return new ParentConnection(new WebSocket(this.context.parent.url));
    },

    createServer() {
        throw 'not implemented';
    }
};

class Manager {
    init(path) {
        //log(`manager.init as ${node.root ? 'root' : 'proxy'}`)
        if (node.root) {
            this.names /*: Map<BusName, BusPath>*/ = new Map();
            this.nodes /*: Map<BusPath, Array<BusName>>*/ = new Map();
            node.registerObject('Bus', this, methods(this), { sender: true });
        } else this.proxy = proxy('/Bus');
        //this.proxies /*: Map<BusName, BusPath>*/ = new Map()
        this.addNode(path);
    }

    addNode(path) {
        if (this.proxy) return this.proxy.addNode(path);
        log$$1('manager.addNode', path);
        if (this.nodes.has(path)) return Promise.reject('duplicate node');
        this.nodes.set(path, new Array());
        return Promise.resolve();
    }

    removeNode(path) {
        if (this.proxy) return this.proxy.removeNode(path);
        log$$1('manager.removeNode', path);
        if (!this.nodes.has(path)) return Promise.reject('missing node');
        return Promise.all(this.nodes.get(path).slice().map(name => this.removeName(name)) // TODO remove children
        ).then(() => this.nodes.delete(path));
    }

    addName(name, _sender) {
        if (this.proxy) return this.proxy.addName(name);
        log$$1('manager.addName', name);
        if (this.names.has(name)) return Promise.reject('duplicate name');
        this.names.set(name, _sender);
        if (!this.nodes.has(_sender)) return Promise.reject('missing node');
        this.nodes.get(_sender).push(name);
        return Promise.resolve();
    }

    resolveName(name) {
        if (this.proxy) return this.proxy.resolveName(name);
        if (!this.names.has(name)) return Promise.reject('missing name');
        log$$1('manager.resolveName', name, this.names.get(name));
        return Promise.resolve(this.names.get(name));
    }

    removeName(name, _sender) {
        if (this.proxy) return this.proxy.removeName(name);
        log$$1('manager.removeName', name);
        if (!this.names.has(name)) return Promise.reject('missing name');
        const path = this.names.get(name);
        this.names.delete(name);
        // TODO check path===_sender
        if (!this.nodes.has(path)) return Promise.reject('missing node');
        const names = this.nodes.get(path),
              i = names.indexOf(name);
        if (i === -1) return Promise.reject('missing name');
        names.splice(i, 1);
        return Promise.resolve();
    }

    check(auth) {
        const { children: { check } = {} } = connection.context;
        return check(auth);
    }
}

//class BusEmitter {
//
//}
//
//class BusObject {
//    constructor (bus) {
//        this.bus = bus
//        this._emitter = new BusEmitter()
//    }
//
//    get emitter () {return this._emitter}
//}

var manager = new Manager();

const logRequest = req => log$$1(`  ${req.id}-> ${req.path}${req.intf}.${req.member}(`, ...req.args, `) from ${req.sender}`);
const logResponse = (req, res) => res.hasOwnProperty('err') ? error$$1(`<-${req.id}  `, res.err, 'FAILED') : log$$1(`<-${req.id}  `, res.res);
class Node {
    constructor() {
        this.conns = [undefined];
        this.objects = {};
        this.reqid = 0;
        this.requests = {};
        this.signals = new EventEmitter();
        this.status = new EventEmitter();
    }

    init(name, parent) {
        log$$1('node.init', name);
        if (parent) {
            parent.id = 0;
            parent.registered = true;
            this.conns[0] = this.bind(parent);
        }
        this.name = name;
        this.root = name === '/';
        manager.init(name);

        if (!this.server && connection.hasChildren) {
            connection.createServer().then(server => {
                this.server = server.on('child', conn => {
                    this.addChild(this.bind(conn));
                }).on('error', err => {
                    error$$1('server error', err.message);
                });
            });
        }
    }

    addChild(conn) {
        conn.id = this.conns.length;
        conn.name = `${this.name}${conn.id}`;
        log$$1(`${this.name} adding child ${conn.name}`);
        conn.hello();
        this.conns.push(conn);
        conn.registered = true;
    }

    route(n) {
        let i = n.lastIndexOf('/');
        if (i === -1) throw new Error('Invalid name');
        let path = n.slice(0, i + 1),
            r = path === this.name ? null : path.startsWith(this.name) ? this.conns[parseInt(path.slice(this.name.length))] : this.conns[0];
        //log(`routing to ${path} from ${this.name} returns ${r && r.name}`)
        return r;
    }

    bind(conn) {
        return conn.on('data', data => {
            //log(`data from ${conn.name}`, data)
            if (data.req) this._request(data.req);else if (data.res) this.response(data.res);else if (data.sig) this.signal(data.sig, conn.id);
        }).on('close', () => {
            log$$1(`connection close ${conn.name}`);
            if (!conn.registered) {
                log$$1('connection was not registered');
                return;
            }
            this.conns[conn.id] = undefined;
            if (conn.id === 0) this.reconnect();else Promise.resolve().then(() => manager.removeNode(`${conn.name}/`)).then(() => log$$1(`connection removed ${conn.name}`)).catch(e => log$$1('manager.removeNode rejected', e));
        });
    }

    reconnect(ms = 1000) {
        this.status.emit('disconnect');
        setTimeout(() => {
            const conn = connection.createParentConnection().on('open', () => {
                log$$1('reconnect parent open');
            }).on('close', () => {
                log$$1('reconnect parent close');
            }).on('connect', name => {
                this.init(name, conn);
                Object.keys(this.objects).forEach(name => manager.addName(name, this.name));
                this.status.emit('reconnect');
            }).on('error', err => {
                error$$1('reconnect parent error', err.message);
                this.reconnect(Math.min(ms * 2, 32000));
            });
        }, ms);
    }

    request(req) {
        return new Promise((r, j) => {
            req.sender = this.name;
            req.id = this.reqid++;
            this.requests[req.id] = { r, j, req };
            this._request(req);
        });
    }

    _request(req) {
        logRequest(req);
        const conn = this.route(req.path);
        if (conn) {
            conn.send({ req });
        } else if (conn === null) {
            Promise.resolve().then(() => {
                const { intf, member, sender } = req,
                      info = this.objects[intf];
                if (!info) throw `Error interface ${intf} object not found`;
                const { obj, meta = {} } = info;
                if (!obj[member]) throw `Error member ${member} not found`;
                let { args } = req;
                if (meta.sender) args = args.concat(sender);
                return obj[member](...args);
            }).then(res => this.response({ id: req.id, path: req.sender, res }), err => this.response({ id: req.id, path: req.sender, err }));
        } else {
            log$$1('_request connection error', req);
        }
    }

    response(res) {
        const conn = this.route(res.path);
        if (conn) conn.send({ res });else if (conn === null) {
            let { r, j, req } = this.requests[res.id];
            delete this.requests[res.id];
            logResponse(req, res);
            if (res.hasOwnProperty('err')) j(res.err);else r(res.res);
        } else {
            error$$1('connection error', res);
        }
    }

    signal(sig, from) {
        this.signals.emit(sig.name, sig.args);
        this.conns.filter(c => c && c.id !== from).forEach(c => {
            //log(`sigrouting ${name} from ${from} to ${c.id}`)
            c && c.send({ sig });
        });
    }

    close() {}

    registerObject(name, obj, intf, meta) {
        log$$1(`registerObject ${name} at ${this.name} interface`, intf);
        this.objects[name] = { obj, intf, meta };
    }

    unregisterObject(name) {
        log$$1(`unRegisterObject ${name} at ${this.name}`);
        delete this.objects[name];
    }
}

var node = new Node();

function executor(_r, _j) {
    return {
        promise: new Promise((r, j) => {
            _r = r;_j = j;
        }),
        resolve: v => _r(v),
        reject: e => _j(e)
    };
}

let start = executor();

/*
 Copyright (C) 2016-2017 Theatersoft

 This program is free software: you can redistribute it and/or modify it under
 the terms of the GNU Affero General Public License as published by the Free
 Software Foundation, version 3.

 This program is distributed in the hope that it will be useful, but WITHOUT
 ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
 FOR A PARTICULAR PURPOSE. See the GNU Affero General Public License for more
 details.

 You should have received a copy of the GNU Affero General Public License along
 with this program. If not, see <http://www.gnu.org/licenses/>
 */
function classes(...a) {
  const b = [];for (const c of a) if (!c) continue;else if ('string' == typeof c) b.push(c);else if ('object' == typeof c) for (const [d, e] of Object.entries(c)) if (e) b.push(d);return b.join(' ');
}

class Icon extends Component$2 {
  render(a) {
    const { icon: b, small: c, cb: d } = a;return h$2('span', { 'class': classes('icon', a.class, c && 'small'), onClick: d }, h$2('svg', { id: `icon-${b}` }, h$2('use', { href: `#svg-${b}` })));
  }
}

var style = { flat: "_flat_1r4gm_1", raised: "_raised_1r4gm_18", inverse: "_inverse_1r4gm_41", floating: "_floating_1r4gm_50", icon: "_icon_1r4gm_82", mini: "_mini_1r4gm_85", neutral: "_neutral_1r4gm_92", primary: "_primary_1r4gm_115", accent: "_accent_1r4gm_129" };

var style$1 = { rippleWrapper: "_rippleWrapper_vr0w5_1", ripple: "_ripple_vr0w5_1", rippleRestarting: "_rippleRestarting_vr0w5_21", rippleActive: "_rippleActive_vr0w5_25" };

var _extends = Object.assign || function (target) {
  for (var i = 1; i < arguments.length; i++) {
    var source = arguments[i];

    for (var key in source) {
      if (Object.prototype.hasOwnProperty.call(source, key)) {
        target[key] = source[key];
      }
    }
  }

  return target;
};

var objectWithoutProperties = function (obj, keys) {
  var target = {};

  for (var i in obj) {
    if (keys.indexOf(i) >= 0) continue;
    if (!Object.prototype.hasOwnProperty.call(obj, i)) continue;
    target[i] = obj[i];
  }

  return target;
};

const mousePosition = a => [a.pageX - (window.scrollX || window.pageXOffset), a.pageY - (window.scrollY || window.pageYOffset)];const touchPosition = a => [a.touches[0].pageX - (window.scrollX || window.pageXOffset), a.touches[0].pageY - (window.scrollY || window.pageYOffset)];var rippleFactory = _ref => {
  let { centered: b = !1, class: c = '', multiple: d = !0, spread: f = 2 } = _ref,
      a = objectWithoutProperties(_ref, ['centered', 'class', 'multiple', 'spread']);return g => {
    var _class2, _temp;return _temp = _class2 = class extends Component$2 {
      constructor() {
        super();this.state = { ripples: {} };this.rippleNodes = {};this.currentCount = 0;
      }componentDidUpdate(i, j) {
        if (Object.keys(j.ripples).length < Object.keys(this.state.ripples).length) this.addRippleRemoveEventListener(this.currentKey);
      }componentWillUnmount() {
        Object.values(this.state.ripples).forEach(i => i.endRipple());
      }animateRipple(i, j, l) {
        const m = () => this.currentKey = `ripple${++this.currentCount}`,
              n = p => {
          const q = p || !this.touchCache;this.touchCache = p;return q;
        },
              o = (p, q) => {
          const { left: r, top: s, height: t, width: u } = this.base.getBoundingClientRect(),
                { rippleCentered: w, rippleSpread: z } = this.props;return { left: w ? 0 : p - r - u / 2, top: w ? 0 : q - s - t / 2, width: u * z };
        };if (n(l)) {
          const { top: p, left: q, width: r } = o(i, j),
                s = 0 === Object.keys(this.state.ripples).length,
                t = this.props.rippleMultiple || s ? m() : this.currentKey,
                u = this.addRippleDeactivateEventListener(l, t),
                w = { active: !1, restarting: !0, top: p, left: q, width: r, endRipple: u },
                z = { active: !0, restarting: !1 },
                A = Object.assign({}, this.state.ripples, { [t]: w });this.setState({ ripples: A }, () => {
            this.setState({ ripples: Object.assign({}, this.state.ripples, { [t]: Object.assign({}, this.state.ripples[t], z) }) });
          });
        }
      }addRippleRemoveEventListener(i) {
        const j = this.rippleNodes[i],
              l = m => {
          if ('opacity' === m.propertyName) {
            if (this.props.onRippleEnded) this.props.onRippleEnded(m);j.removeEventListener('transitionend', l);delete this.rippleNodes[i];const _state$ripples = this.state.ripples,
                  { [i]: n } = _state$ripples,
                  o = objectWithoutProperties(_state$ripples, [i]);this.setState({ ripples: o });
          }
        };j.addEventListener('transitionend', l);
      }addRippleDeactivateEventListener(i, j) {
        const l = i ? 'touchend' : 'mouseup',
              m = () => {
          document.removeEventListener(l, m);this.setState({ ripples: Object.assign({}, this.state.ripples, { [j]: Object.assign({}, this.state.ripples[j], { active: !1 }) }) });
        };document.addEventListener(l, m);return m;
      }renderRipple(i, j, { active: l, left: m, restarting: n, top: o, width: p }) {
        const q = `translate3d(${-p / 2 + m}px, ${-p / 2 + o}px, 0) scale(${n ? 0 : 1})`,
              r = { transform: q, width: p, height: p },
              s = classes(style$1.ripple, { [style$1.rippleActive]: l, [style$1.rippleRestarting]: n }, j);console.log('renderRipple', i, s, r, this.rippleNodes[i]);return h$2('span', _extends({ key: i, 'class': style$1.rippleWrapper }, a), h$2('span', { 'class': s, ref: t => {
            if (t) this.rippleNodes[i] = t;
          }, style: r }));
      }render(_ref2, { ripples: s }) {
        let { ripple: i, rippleClass: j, disabled: l, onRippleEnded: m, rippleCentered: n, rippleMultiple: o, rippleSpread: p, children: q } = _ref2,
            r = objectWithoutProperties(_ref2, ['ripple', 'rippleClass', 'disabled', 'onRippleEnded', 'rippleCentered', 'rippleMultiple', 'rippleSpread', 'children']);const t = !l && i,
              u = z => {
          if (this.props.onMouseDown) this.props.onMouseDown(z);if (t) this.animateRipple(...mousePosition(z), !1);
        },
              w = z => {
          if (this.props.onTouchStart) this.props.onTouchStart(z);if (t) this.animateRipple(...touchPosition(z), !0);
        };return h$2(g, Object.assign({}, t && { onMouseDown: u, onTouchStart: w }, { children: t ? q.concat(Object.entries(s).map(([z, A]) => this.renderRipple(z, j, A))) : q, disabled: l }, r));
      }
    }, _class2.defaultProps = { disabled: !1, ripple: !0, rippleCentered: b, rippleClass: c, rippleMultiple: d, rippleSpread: f }, _temp;
  };
};

var Ripple = a => rippleFactory(a);

const Button$1 = Ripple({ centered: !1 })(class extends Component$2 {
  render(a) {
    const { accent: g = !1, disabled: b, floating: i = !1, icon: c, inverse: d, label: e, mini: j = !1, primary: k = !1, raised: l = !1 } = a,
          f = objectWithoutProperties(a, ['accent', 'disabled', 'floating', 'icon', 'inverse', 'label', 'mini', 'primary', 'raised']);return h$2('button', _extends({ 'class': classes(a.class, k ? style.primary : g ? style.accent : style.neutral, l ? style.raised : i ? style.floating : style.flat, d && style.inverse, j && style.mini) }, { disabled: b }), c && h$2(Icon, { icon: c, 'class': style.icon, small: !0 }), e);
  }
});

var style$2 = { field: "_field_432t5_1", thumb: "_thumb_432t5_8", ripple: "_ripple_432t5_19", on: "_on_432t5_22", off: "_off_432t5_37" };

var thumbFactory = a => a(b => h$2('span', _extends({ 'class': style$2.thumb }, b)));

const switchFactory = a => {
  return class extends Component$2 {
    constructor(...args) {
      var _temp;return _temp = super(...args), this.handleToggle = b => {
        console.log('handleToggle', this.props, b);if (!this.props.disabled && this.props.onChange) {
          this.props.onChange(!this.props.checked, b);
        }
      }, _temp;
    }render({ label: b, checked: c = !1, disabled: d = !1 }) {
      return h$2('label', { 'class': d ? style$2.disabled : style$2.field, onClick: this.handleToggle }, h$2('span', { 'class': c ? style$2.on : style$2.off }, h$2(a, { disabled: d })), b && h$2('span', null, b));
    }
  };
};const Switch = switchFactory(thumbFactory(Ripple({ centered: !0, spread: 2.6 })));

function createCommonjsModule(fn, module) {
  return module = { exports: {} }, fn(module, module.exports), module.exports;
}

var hammer = createCommonjsModule(function (c) {
  (function (d, e) {
    'use strict';
    var g = function (C, D) {
      return new g.Instance(C, D || {});
    };g.VERSION = '1.0.11';g.defaults = { stop_browser_behavior: { userSelect: 'none', touchAction: 'pan-y', touchCallout: 'none', contentZooming: 'none', userDrag: 'none', tapHighlightColor: 'rgba(0,0,0,0)' } };g.HAS_POINTEREVENTS = d.navigator.pointerEnabled || d.navigator.msPointerEnabled;g.HAS_TOUCHEVENTS = 'ontouchstart' in d;g.MOBILE_REGEX = /mobile|tablet|ip(ad|hone|od)|android|silk/i;g.NO_MOUSEEVENTS = g.HAS_TOUCHEVENTS && d.navigator.userAgent.match(g.MOBILE_REGEX);g.EVENT_TYPES = {};g.UPDATE_VELOCITY_INTERVAL = 16;g.DOCUMENT = d.document;var h$$1 = g.DIRECTION_DOWN = 'down',
        j = g.DIRECTION_LEFT = 'left',
        k = g.DIRECTION_UP = 'up',
        l = g.DIRECTION_RIGHT = 'right',
        m = g.POINTER_MOUSE = 'mouse',
        n = g.POINTER_TOUCH = 'touch',
        p = g.POINTER_PEN = 'pen',
        q = g.EVENT_START = 'start',
        r = g.EVENT_MOVE = 'move',
        s = g.EVENT_END = 'end';g.plugins = g.plugins || {};g.gestures = g.gestures || {};g.READY = !1;function f() {
      if (g.READY) {
        return;
      }z.determineEventTypes();t.each(g.gestures, function (C) {
        B.register(C);
      });z.onTouch(g.DOCUMENT, r, B.detect);z.onTouch(g.DOCUMENT, s, B.detect);g.READY = !0;
    }var t = g.utils = { extend: function C(D, E, F) {
        for (var G in E) {
          if (D[G] !== e && F) {
            continue;
          }D[G] = E[G];
        }return D;
      }, each: function C(D, E, F) {
        var G, H;if ('forEach' in D) {
          D.forEach(E, F);
        } else if (D.length !== e) {
          for (G = -1; H = D[++G];) {
            if (!1 === E.call(F, H, G, D)) {
              return;
            }
          }
        } else {
          for (G in D) {
            if (D.hasOwnProperty(G) && !1 === E.call(F, D[G], G, D)) {
              return;
            }
          }
        }
      }, inStr: function C(D, E) {
        return -1 < D.indexOf(E);
      }, hasParent: function C(D, E) {
        while (D) {
          if (D == E) {
            return !0;
          }D = D.parentNode;
        }return !1;
      }, getCenter: function C(D) {
        var E = [],
            F = [],
            G = [],
            H = [],
            I = Math.min,
            J = Math.max;if (1 === D.length) {
          return { pageX: D[0].pageX, pageY: D[0].pageY, clientX: D[0].clientX, clientY: D[0].clientY };
        }t.each(D, function (K) {
          E.push(K.pageX);F.push(K.pageY);G.push(K.clientX);H.push(K.clientY);
        });return { pageX: (I.apply(Math, E) + J.apply(Math, E)) / 2, pageY: (I.apply(Math, F) + J.apply(Math, F)) / 2, clientX: (I.apply(Math, G) + J.apply(Math, G)) / 2, clientY: (I.apply(Math, H) + J.apply(Math, H)) / 2 };
      }, getVelocity: function C(D, E, F) {
        return { x: Math.abs(E / D) || 0, y: Math.abs(F / D) || 0 };
      }, getAngle: function C(D, E) {
        var F = E.clientX - D.clientX,
            G = E.clientY - D.clientY;return 180 * Math.atan2(G, F) / Math.PI;
      }, getDirection: function C(D, E) {
        var F = Math.abs(D.clientX - E.clientX),
            G = Math.abs(D.clientY - E.clientY);if (F >= G) {
          return 0 < D.clientX - E.clientX ? j : l;
        }return 0 < D.clientY - E.clientY ? k : h$$1;
      }, getDistance: function C(D, E) {
        var F = E.clientX - D.clientX,
            G = E.clientY - D.clientY;return Math.sqrt(F * F + G * G);
      }, getScale: function C(D, E) {
        if (2 <= D.length && 2 <= E.length) {
          return this.getDistance(E[0], E[1]) / this.getDistance(D[0], D[1]);
        }return 1;
      }, getRotation: function C(D, E) {
        if (2 <= D.length && 2 <= E.length) {
          return this.getAngle(E[1], E[0]) - this.getAngle(D[1], D[0]);
        }return 0;
      }, isVertical: function C(D) {
        return D == k || D == h$$1;
      }, toggleDefaultBehavior: function C(D, E, F) {
        if (!E || !D || !D.style) {
          return;
        }t.each(['webkit', 'moz', 'Moz', 'ms', 'o', ''], function H(I) {
          t.each(E, function (J, K) {
            if (I) {
              K = I + K.substring(0, 1).toUpperCase() + K.substring(1);
            }if (K in D.style) {
              D.style[K] = !F && J;
            }
          });
        });var G = function () {
          return !1;
        };if ('none' == E.userSelect) {
          D.onselectstart = !F && G;
        }if ('none' == E.userDrag) {
          D.ondragstart = !F && G;
        }
      } };g.Instance = function (C, D) {
      var E = this;f();this.element = C;this.enabled = !0;this.options = t.extend(t.extend({}, g.defaults), D || {});if (this.options.stop_browser_behavior) {
        t.toggleDefaultBehavior(this.element, this.options.stop_browser_behavior, !1);
      }this.eventStartHandler = z.onTouch(C, q, function (F) {
        if (E.enabled) {
          B.startDetect(E, F);
        }
      });this.eventHandlers = [];return this;
    };g.Instance.prototype = { on: function C(D, E) {
        var F = D.split(' ');t.each(F, function (G) {
          this.element.addEventListener(G, E, !1);this.eventHandlers.push({ gesture: G, handler: E });
        }, this);return this;
      }, off: function C(D, E) {
        var F = D.split(' '),
            G,
            H;t.each(F, function (I) {
          this.element.removeEventListener(I, E, !1);for (G = -1; H = this.eventHandlers[++G];) {
            if (H.gesture === I && H.handler === E) {
              this.eventHandlers.splice(G, 1);
            }
          }
        }, this);return this;
      }, trigger: function C(D, E) {
        if (!E) {
          E = {};
        }var F = g.DOCUMENT.createEvent('Event');F.initEvent(D, !0, !0);F.gesture = E;var G = this.element;if (t.hasParent(E.target, G)) {
          G = E.target;
        }G.dispatchEvent(F);return this;
      }, enable: function C(D) {
        this.enabled = D;return this;
      }, dispose: function C() {
        var D, E;if (this.options.stop_browser_behavior) {
          t.toggleDefaultBehavior(this.element, this.options.stop_browser_behavior, !0);
        }for (D = -1; E = this.eventHandlers[++D];) {
          this.element.removeEventListener(E.gesture, E.handler, !1);
        }this.eventHandlers = [];z.unbindDom(this.element, g.EVENT_TYPES[q], this.eventStartHandler);return null;
      } };var u = null,
        v = !1,
        w = !1,
        z = g.event = { bindDom: function (C, D, E) {
        var F = D.split(' ');t.each(F, function (G) {
          C.addEventListener(G, E, !1);
        });
      }, unbindDom: function (C, D, E) {
        var F = D.split(' ');t.each(F, function (G) {
          C.removeEventListener(G, E, !1);
        });
      }, onTouch: function C(D, E, F) {
        var G = this,
            H = function I(J) {
          var K = J.type.toLowerCase();if (t.inStr(K, 'mouse') && w) {
            return;
          } else if (t.inStr(K, 'touch') || t.inStr(K, 'pointerdown') || t.inStr(K, 'mouse') && 1 === J.which) {
            v = !0;
          } else if (t.inStr(K, 'mouse') && !J.which) {
            v = !1;
          }if (t.inStr(K, 'touch') || t.inStr(K, 'pointer')) {
            w = !0;
          }var L = 0;if (v) {
            if (g.HAS_POINTEREVENTS && E != s) {
              L = A.updatePointer(E, J);
            } else if (t.inStr(K, 'touch')) {
              L = J.touches.length;
            } else if (!w) {
              L = t.inStr(K, 'up') ? 0 : 1;
            }if (0 < L && E == s) {
              E = r;
            } else if (!L) {
              E = s;
            }if (L || null == u) {
              u = J;
            }F.call(B, G.collectEventData(D, E, G.getTouchList(u, E), J));if (g.HAS_POINTEREVENTS && E == s) {
              L = A.updatePointer(E, J);
            }
          }if (!L) {
            u = null;v = !1;w = !1;A.reset();
          }
        };this.bindDom(D, g.EVENT_TYPES[E], H);return H;
      }, determineEventTypes: function C() {
        var D;if (g.HAS_POINTEREVENTS) {
          D = A.getEvents();
        } else if (g.NO_MOUSEEVENTS) {
          D = ['touchstart', 'touchmove', 'touchend touchcancel'];
        } else {
          D = ['touchstart mousedown', 'touchmove mousemove', 'touchend touchcancel mouseup'];
        }g.EVENT_TYPES[q] = D[0];g.EVENT_TYPES[r] = D[1];g.EVENT_TYPES[s] = D[2];
      }, getTouchList: function C(D) {
        if (g.HAS_POINTEREVENTS) {
          return A.getTouchList();
        }if (D.touches) {
          return D.touches;
        }D.identifier = 1;return [D];
      }, collectEventData: function C(D, E, F, G) {
        var H = n;if (t.inStr(G.type, 'mouse') || A.matchType(m, G)) {
          H = m;
        }return { center: t.getCenter(F), timeStamp: Date.now(), target: G.target, touches: F, eventType: E, pointerType: H, srcEvent: G, preventDefault: function () {
            var I = this.srcEvent;I.preventManipulation && I.preventManipulation();I.preventDefault && I.preventDefault();
          }, stopPropagation: function () {
            this.srcEvent.stopPropagation();
          }, stopDetect: function () {
            return B.stopDetect();
          } };
      } },
        A = g.PointerEvent = { pointers: {}, getTouchList: function C() {
        var D = [];t.each(this.pointers, function (E) {
          D.push(E);
        });return D;
      }, updatePointer: function C(D, E) {
        if (D == s) {
          delete this.pointers[E.pointerId];
        } else {
          E.identifier = E.pointerId;this.pointers[E.pointerId] = E;
        }return Object.keys(this.pointers).length;
      }, matchType: function C(D, E) {
        if (!E.pointerType) {
          return !1;
        }var F = E.pointerType,
            G = {};G[m] = F === m;G[n] = F === n;G[p] = F === p;return G[D];
      }, getEvents: function C() {
        return ['pointerdown MSPointerDown', 'pointermove MSPointerMove', 'pointerup pointercancel MSPointerUp MSPointerCancel'];
      }, reset: function C() {
        this.pointers = {};
      } },
        B = g.detection = { gestures: [], current: null, previous: null, stopped: !1, startDetect: function C(D, E) {
        if (this.current) {
          return;
        }this.stopped = !1;this.current = { inst: D, startEvent: t.extend({}, E), lastEvent: !1, lastVelocityEvent: !1, velocity: !1, name: '' };this.detect(E);
      }, detect: function C(D) {
        if (!this.current || this.stopped) {
          return;
        }D = this.extendEventData(D);var E = this.current.inst,
            F = E.options;t.each(this.gestures, function G(H) {
          if (!this.stopped && !1 !== F[H.name] && !1 !== E.enabled) {
            if (!1 === H.handler.call(H, D, E)) {
              this.stopDetect();return !1;
            }
          }
        }, this);if (this.current) {
          this.current.lastEvent = D;
        }if (D.eventType == s && !D.touches.length - 1) {
          this.stopDetect();
        }return D;
      }, stopDetect: function C() {
        this.previous = t.extend({}, this.current);this.current = null;this.stopped = !0;
      }, getVelocityData: function C(D, E, F, G) {
        var H = this.current,
            I = H.lastVelocityEvent,
            J = H.velocity;if (I && D.timeStamp - I.timeStamp > g.UPDATE_VELOCITY_INTERVAL) {
          J = t.getVelocity(D.timeStamp - I.timeStamp, D.center.clientX - I.center.clientX, D.center.clientY - I.center.clientY);H.lastVelocityEvent = D;
        } else if (!H.velocity) {
          J = t.getVelocity(E, F, G);H.lastVelocityEvent = D;
        }H.velocity = J;D.velocityX = J.x;D.velocityY = J.y;
      }, getInterimData: function C(D) {
        var E = this.current.lastEvent,
            F,
            G;if (D.eventType == s) {
          F = E && E.interimAngle;G = E && E.interimDirection;
        } else {
          F = E && t.getAngle(E.center, D.center);G = E && t.getDirection(E.center, D.center);
        }D.interimAngle = F;D.interimDirection = G;
      }, extendEventData: function C(D) {
        var E = this.current,
            F = E.startEvent;if (D.touches.length != F.touches.length || D.touches === F.touches) {
          F.touches = [];t.each(D.touches, function (J) {
            F.touches.push(t.extend({}, J));
          });
        }var G = D.timeStamp - F.timeStamp,
            H = D.center.clientX - F.center.clientX,
            I = D.center.clientY - F.center.clientY;this.getVelocityData(D, G, H, I);this.getInterimData(D);t.extend(D, { startEvent: F, deltaTime: G, deltaX: H, deltaY: I, distance: t.getDistance(F.center, D.center), angle: t.getAngle(F.center, D.center), direction: t.getDirection(F.center, D.center), scale: t.getScale(F.touches, D.touches), rotation: t.getRotation(F.touches, D.touches) });return D;
      }, register: function C(D) {
        var E = D.defaults || {};if (E[D.name] === e) {
          E[D.name] = !0;
        }t.extend(g.defaults, E, !0);D.index = D.index || 1000;this.gestures.push(D);this.gestures.sort(function (F, G) {
          if (F.index < G.index) {
            return -1;
          }if (F.index > G.index) {
            return 1;
          }return 0;
        });return this.gestures;
      } };g.gestures.Drag = { name: 'drag', index: 50, defaults: { drag_min_distance: 10, correct_for_drag_min_distance: !0, drag_max_touches: 1, drag_block_horizontal: !1, drag_block_vertical: !1, drag_lock_to_axis: !1, drag_lock_min_distance: 25 }, triggered: !1, handler: function C(D, E) {
        var F = B.current;if (F.name != this.name && this.triggered) {
          E.trigger(this.name + 'end', D);this.triggered = !1;return;
        }if (0 < E.options.drag_max_touches && D.touches.length > E.options.drag_max_touches) {
          return;
        }switch (D.eventType) {case q:
            this.triggered = !1;break;case r:
            if (D.distance < E.options.drag_min_distance && F.name != this.name) {
              return;
            }var G = F.startEvent.center;if (F.name != this.name) {
              F.name = this.name;if (E.options.correct_for_drag_min_distance && 0 < D.distance) {
                var H = Math.abs(E.options.drag_min_distance / D.distance);G.pageX += D.deltaX * H;G.pageY += D.deltaY * H;G.clientX += D.deltaX * H;G.clientY += D.deltaY * H;D = B.extendEventData(D);
              }
            }if (F.lastEvent.drag_locked_to_axis || E.options.drag_lock_to_axis && E.options.drag_lock_min_distance <= D.distance) {
              D.drag_locked_to_axis = !0;
            }var I = F.lastEvent.direction;if (D.drag_locked_to_axis && I !== D.direction) {
              if (t.isVertical(I)) {
                D.direction = 0 > D.deltaY ? k : h$$1;
              } else {
                D.direction = 0 > D.deltaX ? j : l;
              }
            }if (!this.triggered) {
              E.trigger(this.name + 'start', D);this.triggered = !0;
            }E.trigger(this.name, D);E.trigger(this.name + D.direction, D);var J = t.isVertical(D.direction);if (E.options.drag_block_vertical && J || E.options.drag_block_horizontal && !J) {
              D.preventDefault();
            }break;case s:
            if (this.triggered) {
              E.trigger(this.name + 'end', D);
            }this.triggered = !1;break;}
      } };g.gestures.Hold = { name: 'hold', index: 10, defaults: { hold_timeout: 500, hold_threshold: 2 }, timer: null, handler: function C(D, E) {
        switch (D.eventType) {case q:
            clearTimeout(this.timer);B.current.name = this.name;this.timer = setTimeout(function () {
              if ('hold' == B.current.name) {
                E.trigger('hold', D);
              }
            }, E.options.hold_timeout);break;case r:
            if (D.distance > E.options.hold_threshold) {
              clearTimeout(this.timer);
            }break;case s:
            clearTimeout(this.timer);break;}
      } };g.gestures.Release = { name: 'release', index: 1 / 0, handler: function C(D, E) {
        if (D.eventType == s) {
          E.trigger(this.name, D);
        }
      } };g.gestures.Swipe = { name: 'swipe', index: 40, defaults: { swipe_min_touches: 1, swipe_max_touches: 1, swipe_velocity: 0.7 }, handler: function C(D, E) {
        if (D.eventType == s) {
          if (D.touches.length < E.options.swipe_min_touches || D.touches.length > E.options.swipe_max_touches) {
            return;
          }if (D.velocityX > E.options.swipe_velocity || D.velocityY > E.options.swipe_velocity) {
            E.trigger(this.name, D);E.trigger(this.name + D.direction, D);
          }
        }
      } };g.gestures.Tap = { name: 'tap', index: 100, defaults: { tap_max_touchtime: 250, tap_max_distance: 10, tap_always: !0, doubletap_distance: 20, doubletap_interval: 300 }, has_moved: !1, handler: function C(D, E) {
        var F, G, H;if (D.eventType == q) {
          this.has_moved = !1;
        } else if (D.eventType == r && !this.moved) {
          this.has_moved = D.distance > E.options.tap_max_distance;
        } else if (D.eventType == s && 'touchcancel' != D.srcEvent.type && D.deltaTime < E.options.tap_max_touchtime && !this.has_moved) {
          F = B.previous;G = F && F.lastEvent && D.timeStamp - F.lastEvent.timeStamp;H = !1;if (F && 'tap' == F.name && G && G < E.options.doubletap_interval && D.distance < E.options.doubletap_distance) {
            E.trigger('doubletap', D);H = !0;
          }if (!H || E.options.tap_always) {
            B.current.name = 'tap';E.trigger(B.current.name, D);
          }
        }
      } };g.gestures.Touch = { name: 'touch', index: -(1 / 0), defaults: { prevent_default: !1, prevent_mouseevents: !1 }, handler: function C(D, E) {
        if (E.options.prevent_mouseevents && D.pointerType == m) {
          D.stopDetect();return;
        }if (E.options.prevent_default) {
          D.preventDefault();
        }if (D.eventType == q) {
          E.trigger(this.name, D);
        }
      } };g.gestures.Transform = { name: 'transform', index: 45, defaults: { transform_min_scale: 0.01, transform_min_rotation: 1, transform_always_block: !1, transform_within_instance: !1 }, triggered: !1, handler: function C(D, E) {
        if (B.current.name != this.name && this.triggered) {
          E.trigger(this.name + 'end', D);this.triggered = !1;return;
        }if (2 > D.touches.length) {
          return;
        }if (E.options.transform_always_block) {
          D.preventDefault();
        }if (E.options.transform_within_instance) {
          for (var F = -1; D.touches[++F];) {
            if (!t.hasParent(D.touches[F].target, E.element)) {
              return;
            }
          }
        }switch (D.eventType) {case q:
            this.triggered = !1;break;case r:
            var G = Math.abs(1 - D.scale),
                H = Math.abs(D.rotation);if (G < E.options.transform_min_scale && H < E.options.transform_min_rotation) {
              return;
            }B.current.name = this.name;if (!this.triggered) {
              E.trigger(this.name + 'start', D);this.triggered = !0;
            }E.trigger(this.name, D);if (H > E.options.transform_min_rotation) {
              E.trigger('rotate', D);
            }if (G > E.options.transform_min_scale) {
              E.trigger('pinch', D);E.trigger('pinch' + (1 > D.scale ? 'in' : 'out'), D);
            }break;case s:
            if (this.triggered) {
              E.trigger(this.name + 'end', D);
            }this.triggered = !1;break;}
      } };if ('function' == typeof define && define.amd) {
      define(function () {
        return g;
      });
    } else if ('object' == typeof c && c.exports) {
      c.exports = g;
    } else {
      d.Hammer = g;
    }
  })(window);
});

const stack$2 = [];let sink = {};const focus = new (mixinEventEmitter(class {
  constructor() {
    hammer(window.document.body, { drag_lock_to_axis: !0 }).on('tap dragleft dragright dragend swipeleft swiperight', a => {
      if (sink.onGesture) sink.onGesture(a);else if (sink.emit) sink.emit('gesture', a);
    });document.onkeydown = a => {
      if (8 === a.keyCode) {
        console.log('back');var b = a.srcElement || a.target;if (!('INPUT' === b.tagName.toUpperCase() && 'TEXT' === b.type.toUpperCase())) {
          a.preventDefault();
        }
      }if (sink.onKeydown) sink.onKeydown(a);else if (sink.emit) sink.emit('keydown', a);
    };
  }push(a) {
    stack$2.push({ name: a });this.emit('focused', a);
  }pop() {
    if (stack$2.length) {
      stack$2.pop();const a = stack$2[stack$2.length - 1];sink = a.sink;this.emit('focused', a.name);
    }
  }register(a, b) {
    console.log('focus.register', b);sink = stack$2[stack$2.length - 1].sink = a;
  }
}))();

var _extends$1 = Object.assign || function (target) {
  for (var i = 1; i < arguments.length; i++) {
    var source = arguments[i];

    for (var key in source) {
      if (Object.prototype.hasOwnProperty.call(source, key)) {
        target[key] = source[key];
      }
    }
  }

  return target;
};

var get = function get(object, property, receiver) {
  if (object === null) object = Function.prototype;
  var desc = Object.getOwnPropertyDescriptor(object, property);

  if (desc === undefined) {
    var parent = Object.getPrototypeOf(object);

    if (parent === null) {
      return undefined;
    } else {
      return get(parent, property, receiver);
    }
  } else if ("value" in desc) {
    return desc.value;
  } else {
    var getter = desc.get;

    if (getter === undefined) {
      return undefined;
    }

    return getter.call(receiver);
  }
};

















var set = function set(object, property, value, receiver) {
  var desc = Object.getOwnPropertyDescriptor(object, property);

  if (desc === undefined) {
    var parent = Object.getPrototypeOf(object);

    if (parent !== null) {
      set(parent, property, value, receiver);
    }
  } else if ("value" in desc && desc.writable) {
    desc.value = value;
  } else {
    var setter = desc.set;

    if (setter !== undefined) {
      setter.call(receiver, value);
    }
  }

  return value;
};

var Button$$1 = (({ light }) => {
    const inverse = !light;
    return h$1(
        'section',
        { 'class': classes({ light }) },
        h$1(Button$1, _extends$1({ icon: 'cross', label: 'Flat', flat: true }, { inverse })),
        h$1(Button$1, _extends$1({ label: 'Flat', primary: true }, { inverse })),
        h$1(Button$1, _extends$1({ label: 'Flat', accent: true }, { inverse })),
        h$1(Button$1, _extends$1({ icon: 'cross', label: 'Raised', raised: true }, { inverse })),
        h$1(Button$1, _extends$1({ icon: 'cross', label: 'Primary', raised: true, primary: true }, { inverse })),
        h$1(Button$1, _extends$1({ label: 'Accent', raised: true, accent: true }, { inverse })),
        h$1(Button$1, _extends$1({ icon: 'cross', floating: true }, { inverse })),
        h$1(Button$1, _extends$1({ label: '8', floating: true, primary: true, mini: true }, { inverse })),
        h$1(Button$1, _extends$1({ icon: 'cross', floating: true, accent: true, mini: true }, { inverse }))
    );
});

var Icon$1 = (() => h$1(
    'section',
    null,
    h$1(Icon, { icon: 'arrow-up' }),
    h$1(Icon, { icon: 'arrow-down' }),
    h$1(Icon, { icon: 'arrow-up', small: true }),
    h$1(Icon, { icon: 'arrow-down', small: true })
));

var Switch$1 = class extends Component$1 {
    render(p, { sw }) {
        return h$1(
            'section',
            null,
            h$1(Switch, {
                checked: sw,
                label: 'Switch',
                onChange: value => this.setState({ sw: value })
            })
        );
    }
};

__$styleInject("section {\n  display: flex;\n  flex-flow: row wrap;\n  align-items: center;\n  margin: 2rem 4rem;\n  padding: 2rem;\n  background-color: rgba(33,33,33,0.8);\n  box-shadow: 0 1rem 2rem rgba(0,0,0,0.5);\n}\nsection._light_1idha_10 {\n  background-color: rgba(245,245,245,0.7);\n}\n._scroll_1idha_13 {\n  overflow-y: scroll !important;\n  height: inherit;\n}\n", { "light": "_light_1idha_10", "scroll": "_scroll_1idha_13" });

var App = (() => h$1(
    'div',
    { 'class': 'scroll' },
    h$1(Switch$1, null),
    h$1(Icon$1, null),
    h$1(Button$$1, null),
    h$1(Button$$1, { light: true }),
    h$1(Button$$1, null)
));

__$styleInject("@font-face {\n  font-family: 'Alegreya Sans SC';\n  font-style: normal;\n  font-weight: 400;\n  src: url(\"/res/alegreyasanssc.ttf\");\n}\nhtml {\n  box-sizing: border-box;\n}\n*,\n*:before,\n*:after {\n  box-sizing: inherit;\n  padding: 0;\n  margin: 0;\n}\n.container {\n  position: absolute;\n  width: 100%;\n  height: 100%;\n  padding: 0 2.666666666666667rem;\n}\n.row {\n  margin: 0 -2.666666666666667rem;\n}\n.row:after {\n  content: \"\";\n  display: table;\n  clear: both;\n}\n.col {\n  float: left;\n  padding: 1rem 2rem;\n}\n.inset {\n  background-color: rgba(33,33,33,0.8);\n  position: absolute;\n  top: 0rem;\n  height: 100rem;\n  left: 13.333333333333332rem;\n  width: 106.66666666666666rem;\n  overflow-y: auto !important;\n}\n.inset #icon-cross {\n  position: absolute;\n  top: 0;\n  right: 0;\n}\n::-webkit-scrollbar {\n  width: 4rem;\n}\n::-webkit-scrollbar-track {\n  background-color: transparent;\n}\n::-webkit-scrollbar-thumb {\n  background-color: #ffc107;\n  border-radius: 2rem;\n}\n.icon {\n  display: inline-block;\n  line-height: 0;\n}\n.icon svg {\n  fill: currentColor;\n  vertical-align: middle;\n}\n.icon:not(.small) svg {\n  width: 9rem;\n  height: 9rem;\n}\n.icon.small svg {\n  width: 6rem;\n  height: 6rem;\n}\n._flat_1r4gm_1 {\n  display: flex;\n  height: 10.8rem;\n  text-align: center;\n  flex-direction: row;\n  align-items: center;\n  justify-content: center;\n  border: 0;\n  outline: none;\n  font-size: 8rem;\n  font-family: Alegreya Sans SC;\n  text-transform: uppercase;\n  min-width: 27rem;\n  padding: 0 2.4rem;\n  border-radius: 0.6rem;\n  background: transparent;\n}\n._raised_1r4gm_18 {\n  display: flex;\n  height: 10.8rem;\n  text-align: center;\n  flex-direction: row;\n  align-items: center;\n  justify-content: center;\n  border: 0;\n  outline: none;\n  font-size: 8rem;\n  font-family: Alegreya Sans SC;\n  text-transform: uppercase;\n  min-width: 27rem;\n  padding: 0 2.4rem;\n  border-radius: 0.6rem;\n  box-shadow: 0 2rem 2rem 0 rgba(0,0,0,0.14), 0 3rem 1rem -2rem rgba(0,0,0,0.2), 0 1rem 5rem 0 rgba(0,0,0,0.12);\n}\n._raised_1r4gm_18:active {\n  box-shadow: 0 4rem 5rem rgba(0,0,0,0.14), 0 1rem 10rem rgba(0,0,0,0.12), 0 2rem 4rem -1rem rgba(0,0,0,0.2);\n}\n._raised_1r4gm_18:focus:not(:active) {\n  box-shadow: 0 0 4rem rgba(0,0,0,0.18), 0 4rem 8rem rgba(0,0,0,0.36);\n}\n._raised_1r4gm_18._inverse_1r4gm_41:active {\n  box-shadow: 0 4rem 5rem rgba(255,255,255,0.14), 0 1rem 10rem rgba(0,0,0,0.12);\n}\n._raised_1r4gm_18._inverse_1r4gm_41:focus:not(:active) {\n  box-shadow: 0 0 4rem rgba(255,255,255,0.18), 0 4rem 8rem rgba(0,0,0,0.36);\n}\n._raised_1r4gm_18._inverse_1r4gm_41 {\n  box-shadow: 0 1rem 1rem 0 rgba(255,255,255,0.3), 0 1rem 5rem 0 rgba(0,0,0,0.1);\n}\n._floating_1r4gm_50 {\n  display: flex;\n  height: 10.8rem;\n  text-align: center;\n  flex-direction: row;\n  align-items: center;\n  justify-content: center;\n  border: 0;\n  outline: none;\n  font-size: 8rem;\n  font-family: Alegreya Sans SC;\n  text-transform: uppercase;\n  border-radius: 50%;\n  box-shadow: 0 1rem 1.5rem 0 rgba(0,0,0,0.12), 0 1rem 1rem 0 rgba(0,0,0,0.24);\n  width: 15.899999999999999rem;\n  height: 15.899999999999999rem;\n}\n._floating_1r4gm_50:active {\n  box-shadow: 0 4rem 5rem rgba(0,0,0,0.14), 0 1rem 10rem rgba(0,0,0,0.12), 0 2rem 4rem -1rem rgba(0,0,0,0.2);\n}\n._floating_1r4gm_50:focus:not(:active) {\n  box-shadow: 0 0 4rem rgba(0,0,0,0.18), 0 4rem 8rem rgba(0,0,0,0.36);\n}\n._floating_1r4gm_50._inverse_1r4gm_41:active {\n  box-shadow: 0 4rem 5rem rgba(255,255,255,0.14), 0 1rem 10rem rgba(0,0,0,0.12);\n}\n._floating_1r4gm_50._inverse_1r4gm_41:focus:not(:active) {\n  box-shadow: 0 0 4rem rgba(255,255,255,0.18), 0 4rem 8rem rgba(0,0,0,0.36);\n}\n._floating_1r4gm_50._inverse_1r4gm_41 {\n  box-shadow: 0 1rem 1rem 0 rgba(255,255,255,0.4), 0 1rem 1rem 0 rgba(0,0,0,0.4);\n}\n._floating_1r4gm_50 ._icon_1r4gm_82 {\n  display: inline-block;\n}\n._floating_1r4gm_50._mini_1r4gm_85 {\n  width: 10.8rem;\n  height: 10.8rem;\n}\n._floating_1r4gm_50._mini_1r4gm_85 ._icon_1r4gm_82 {\n  display: inline-block;\n}\n._neutral_1r4gm_92._raised_1r4gm_18,\n._neutral_1r4gm_92._floating_1r4gm_50 {\n  color: #212121;\n  background: #fff;\n}\n._neutral_1r4gm_92._flat_1r4gm_1 {\n  color: #212121;\n  background: transparent;\n}\n._neutral_1r4gm_92._flat_1r4gm_1:hover {\n  background: rgba(117,117,117,0.6);\n}\n._neutral_1r4gm_92._inverse_1r4gm_41._raised_1r4gm_18,\n._neutral_1r4gm_92._inverse_1r4gm_41._floating_1r4gm_50 {\n  color: #fff;\n  background: #212121;\n}\n._neutral_1r4gm_92._inverse_1r4gm_41._flat_1r4gm_1 {\n  color: #fff;\n}\n._neutral_1r4gm_92._inverse_1r4gm_41._flat_1r4gm_1:hover {\n  background: rgba(117,117,117,0.6);\n}\n._primary_1r4gm_115._raised_1r4gm_18,\n._primary_1r4gm_115._floating_1r4gm_50 {\n  color: #fff;\n  background: #607d8b;\n}\n._primary_1r4gm_115._flat_1r4gm_1 {\n  color: #607d8b;\n}\n._primary_1r4gm_115._flat_1r4gm_1:hover {\n  background: rgba(144,164,174,0.5);\n}\n._primary_1r4gm_115._inverse_1r4gm_41._flat_1r4gm_1 {\n  color: #90a4ae;\n}\n._accent_1r4gm_129._raised_1r4gm_18,\n._accent_1r4gm_129._floating_1r4gm_50 {\n  color: #000;\n  background: #ffc107;\n}\n._accent_1r4gm_129._flat_1r4gm_1 {\n  color: #ffc107;\n}\n._accent_1r4gm_129._flat_1r4gm_1:hover {\n  background: rgba(255,193,7,0.3);\n}\n._rippleWrapper_vr0w5_1 {\n  position: absolute;\n  top: 0;\n  right: 0;\n  bottom: 0;\n  left: 0;\n  z-index: 1;\n  pointer-events: none;\n}\n._ripple_vr0w5_1 {\n  position: absolute;\n  top: 50%;\n  left: 50%;\n  z-index: 100;\n  pointer-events: none;\n  background-color: currentColor;\n  border-radius: 50%;\n  transform-origin: 50% 50%;\n  transition-duration: 800ms;\n}\n._ripple_vr0w5_1._rippleRestarting_vr0w5_21 {\n  opacity: 0.3;\n  transition-property: none;\n}\n._ripple_vr0w5_1._rippleActive_vr0w5_25 {\n  opacity: 0.3;\n  transition-property: transform;\n}\n._ripple_vr0w5_1:not(._rippleActive_vr0w5_25):not(._rippleRestarting_vr0w5_21) {\n  opacity: 0;\n  transition-property: opacity, transform;\n}\n._field_432t5_1 {\n  position: relative;\n  display: block;\n  height: auto;\n  white-space: nowrap;\n  vertical-align: middle;\n}\n._thumb_432t5_8 {\n  transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);\n  transition-duration: 0.2s;\n  position: absolute;\n  top: -0.72rem;\n  width: 4.8rem;\n  height: 4.8rem;\n  cursor: pointer;\n  border-radius: 50%;\n  transition-property: left;\n}\n._thumb_432t5_8 ._ripple_432t5_19 {\n  transition-duration: 550ms;\n}\n._on_432t5_22 {\n  position: relative;\n  display: inline-block;\n  width: 9.12rem;\n  height: 3.36rem;\n  margin-top: 1.2rem;\n  vertical-align: top;\n  cursor: pointer;\n  border-radius: 4rem;\n  background: rgba(255,193,7,0.5);\n}\n._on_432t5_22 ._thumb_432t5_8 {\n  left: 4.319999999999999rem;\n  background: #ffc107;\n}\n._off_432t5_37 {\n  position: relative;\n  display: inline-block;\n  width: 9.12rem;\n  height: 3.36rem;\n  margin-top: 1.2rem;\n  vertical-align: top;\n  cursor: pointer;\n  border-radius: 4rem;\n  background: #fefefe;\n}\n._off_432t5_37 ._thumb_432t5_8 {\n  left: 0;\n  background: #fafafa;\n}\nbody {\n  background: #000;\n  position: absolute;\n  left: 50%;\n  top: 50%;\n  user-select: none;\n}\nbody,\nhtml {\n  width: 100%;\n  height: 100%;\n  margin: 0;\n  padding: 0;\n  overflow: hidden;\n  user-select: none;\n}\n@font-face {\n  font-family: 'Alegreya Sans SC';\n  font-style: normal;\n  font-weight: 400;\n  src: url(\"/res/alegreyasanssc.ttf\");\n}\n#_video_16h5h_1,\n#_ui_16h5h_1 {\n  position: absolute;\n  width: 100%;\n  height: 100%;\n  margin: 0;\n  padding: 0;\n}\n#_ui_16h5h_1 {\n  font-size: 8rem;\n  font-family: Alegreya Sans SC;\n  color: #e0e0e0;\n}\n#_video_16h5h_1 {\n  background-image: url(\"http://192.168.1.16:5402\");\n  background-size: contain;\n}\n", { "video": "_video_16h5h_1", "ui": "_ui_16h5h_1" });

//import '../../spec/res/_icons.svg'

render(h(App, null), document.getElementById('ui'));

}());
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjpudWxsLCJzb3VyY2VzIjpbIi4uL25vZGVfbW9kdWxlcy9wcmVhY3Qvc3JjL3Zub2RlLmpzIiwiLi4vbm9kZV9tb2R1bGVzL3ByZWFjdC9zcmMvb3B0aW9ucy5qcyIsIi4uL25vZGVfbW9kdWxlcy9wcmVhY3Qvc3JjL2guanMiLCIuLi9ub2RlX21vZHVsZXMvcHJlYWN0L3NyYy91dGlsLmpzIiwiLi4vbm9kZV9tb2R1bGVzL3ByZWFjdC9zcmMvY29uc3RhbnRzLmpzIiwiLi4vbm9kZV9tb2R1bGVzL3ByZWFjdC9zcmMvcmVuZGVyLXF1ZXVlLmpzIiwiLi4vbm9kZV9tb2R1bGVzL3ByZWFjdC9zcmMvdmRvbS9pbmRleC5qcyIsIi4uL25vZGVfbW9kdWxlcy9wcmVhY3Qvc3JjL2RvbS9pbmRleC5qcyIsIi4uL25vZGVfbW9kdWxlcy9wcmVhY3Qvc3JjL3Zkb20vZGlmZi5qcyIsIi4uL25vZGVfbW9kdWxlcy9wcmVhY3Qvc3JjL3Zkb20vY29tcG9uZW50LXJlY3ljbGVyLmpzIiwiLi4vbm9kZV9tb2R1bGVzL3ByZWFjdC9zcmMvdmRvbS9jb21wb25lbnQuanMiLCIuLi9ub2RlX21vZHVsZXMvcHJlYWN0L3NyYy9jb21wb25lbnQuanMiLCIuLi9ub2RlX21vZHVsZXMvcHJlYWN0L3NyYy9yZW5kZXIuanMiLCIuLi8uLi9zcGVjL3NyYy9yZXNpemUuanMiLCIuLi8uLi9zcGVjL25vZGVfbW9kdWxlcy9wcmVhY3Qvc3JjL3Zub2RlLmpzIiwiLi4vLi4vc3BlYy9ub2RlX21vZHVsZXMvcHJlYWN0L3NyYy9vcHRpb25zLmpzIiwiLi4vLi4vc3BlYy9ub2RlX21vZHVsZXMvcHJlYWN0L3NyYy9oLmpzIiwiLi4vLi4vc3BlYy9ub2RlX21vZHVsZXMvcHJlYWN0L3NyYy91dGlsLmpzIiwiLi4vLi4vc3BlYy9ub2RlX21vZHVsZXMvcHJlYWN0L3NyYy9jb25zdGFudHMuanMiLCIuLi8uLi9zcGVjL25vZGVfbW9kdWxlcy9wcmVhY3Qvc3JjL3JlbmRlci1xdWV1ZS5qcyIsIi4uLy4uL3NwZWMvbm9kZV9tb2R1bGVzL3ByZWFjdC9zcmMvdmRvbS9pbmRleC5qcyIsIi4uLy4uL3NwZWMvbm9kZV9tb2R1bGVzL3ByZWFjdC9zcmMvZG9tL2luZGV4LmpzIiwiLi4vLi4vc3BlYy9ub2RlX21vZHVsZXMvcHJlYWN0L3NyYy92ZG9tL2RpZmYuanMiLCIuLi8uLi9zcGVjL25vZGVfbW9kdWxlcy9wcmVhY3Qvc3JjL3Zkb20vY29tcG9uZW50LXJlY3ljbGVyLmpzIiwiLi4vLi4vc3BlYy9ub2RlX21vZHVsZXMvcHJlYWN0L3NyYy92ZG9tL2NvbXBvbmVudC5qcyIsIi4uLy4uL3NwZWMvbm9kZV9tb2R1bGVzL3ByZWFjdC9zcmMvY29tcG9uZW50LmpzIiwiLi4vLi4vc3BlYy9ub2RlX21vZHVsZXMvcHJlYWN0L3NyYy9yZW5kZXIuanMiLCIuLi8uLi9ub2RlX21vZHVsZXMvcHJlYWN0L3NyYy92bm9kZS5qcyIsIi4uLy4uL25vZGVfbW9kdWxlcy9wcmVhY3Qvc3JjL29wdGlvbnMuanMiLCIuLi8uLi9ub2RlX21vZHVsZXMvcHJlYWN0L3NyYy9oLmpzIiwiLi4vLi4vbm9kZV9tb2R1bGVzL3ByZWFjdC9zcmMvdXRpbC5qcyIsIi4uLy4uL25vZGVfbW9kdWxlcy9wcmVhY3Qvc3JjL2NvbnN0YW50cy5qcyIsIi4uLy4uL25vZGVfbW9kdWxlcy9wcmVhY3Qvc3JjL2xpbmtlZC1zdGF0ZS5qcyIsIi4uLy4uL25vZGVfbW9kdWxlcy9wcmVhY3Qvc3JjL3JlbmRlci1xdWV1ZS5qcyIsIi4uLy4uL25vZGVfbW9kdWxlcy9wcmVhY3Qvc3JjL3Zkb20vZnVuY3Rpb25hbC1jb21wb25lbnQuanMiLCIuLi8uLi9ub2RlX21vZHVsZXMvcHJlYWN0L3NyYy92ZG9tL2luZGV4LmpzIiwiLi4vLi4vbm9kZV9tb2R1bGVzL3ByZWFjdC9zcmMvZG9tL2luZGV4LmpzIiwiLi4vLi4vbm9kZV9tb2R1bGVzL3ByZWFjdC9zcmMvZG9tL3JlY3ljbGVyLmpzIiwiLi4vLi4vbm9kZV9tb2R1bGVzL3ByZWFjdC9zcmMvdmRvbS9kaWZmLmpzIiwiLi4vLi4vbm9kZV9tb2R1bGVzL3ByZWFjdC9zcmMvdmRvbS9jb21wb25lbnQtcmVjeWNsZXIuanMiLCIuLi8uLi9ub2RlX21vZHVsZXMvcHJlYWN0L3NyYy92ZG9tL2NvbXBvbmVudC5qcyIsIi4uLy4uL25vZGVfbW9kdWxlcy9wcmVhY3Qvc3JjL2NvbXBvbmVudC5qcyIsIi4uLy4uL25vZGVfbW9kdWxlcy9wcmVhY3Qvc3JjL3JlbmRlci5qcyIsIi4uLy4uLy4uL2J1cy9kaXN0L2J1cy5icm93c2VyLmVzLmpzIiwiLi4vLi4vZGlzdC9jb21wb25lbnRzLmVzLmpzIiwiLi4vLi4vc3BlYy9zcmMvY29tcG9uZW50cy9idXR0b24uanMiLCIuLi8uLi9zcGVjL3NyYy9jb21wb25lbnRzL2ljb24uanMiLCIuLi8uLi9zcGVjL3NyYy9jb21wb25lbnRzL3N3aXRjaC5qcyIsIi4uLy4uL3NwZWMvc3JjL0FwcC5qcyIsIi4uL3NyYy9pbmRleC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKiogVmlydHVhbCBET00gTm9kZSAqL1xuZXhwb3J0IGZ1bmN0aW9uIFZOb2RlKCkge31cbiIsIi8qKiBHbG9iYWwgb3B0aW9uc1xuICpcdEBwdWJsaWNcbiAqXHRAbmFtZXNwYWNlIG9wdGlvbnMge09iamVjdH1cbiAqL1xuZXhwb3J0IGRlZmF1bHQge1xuXG5cdC8qKiBJZiBgdHJ1ZWAsIGBwcm9wYCBjaGFuZ2VzIHRyaWdnZXIgc3luY2hyb25vdXMgY29tcG9uZW50IHVwZGF0ZXMuXG5cdCAqXHRAbmFtZSBzeW5jQ29tcG9uZW50VXBkYXRlc1xuXHQgKlx0QHR5cGUgQm9vbGVhblxuXHQgKlx0QGRlZmF1bHQgdHJ1ZVxuXHQgKi9cblx0Ly9zeW5jQ29tcG9uZW50VXBkYXRlczogdHJ1ZSxcblxuXHQvKiogUHJvY2Vzc2VzIGFsbCBjcmVhdGVkIFZOb2Rlcy5cblx0ICpcdEBwYXJhbSB7Vk5vZGV9IHZub2RlXHRBIG5ld2x5LWNyZWF0ZWQgVk5vZGUgdG8gbm9ybWFsaXplL3Byb2Nlc3Ncblx0ICovXG5cdC8vdm5vZGUodm5vZGUpIHsgfVxuXG5cdC8qKiBIb29rIGludm9rZWQgYWZ0ZXIgYSBjb21wb25lbnQgaXMgbW91bnRlZC4gKi9cblx0Ly8gYWZ0ZXJNb3VudChjb21wb25lbnQpIHsgfVxuXG5cdC8qKiBIb29rIGludm9rZWQgYWZ0ZXIgdGhlIERPTSBpcyB1cGRhdGVkIHdpdGggYSBjb21wb25lbnQncyBsYXRlc3QgcmVuZGVyLiAqL1xuXHQvLyBhZnRlclVwZGF0ZShjb21wb25lbnQpIHsgfVxuXG5cdC8qKiBIb29rIGludm9rZWQgaW1tZWRpYXRlbHkgYmVmb3JlIGEgY29tcG9uZW50IGlzIHVubW91bnRlZC4gKi9cblx0Ly8gYmVmb3JlVW5tb3VudChjb21wb25lbnQpIHsgfVxufTtcbiIsImltcG9ydCB7IFZOb2RlIH0gZnJvbSAnLi92bm9kZSc7XG5pbXBvcnQgb3B0aW9ucyBmcm9tICcuL29wdGlvbnMnO1xuXG5cbmNvbnN0IHN0YWNrID0gW107XG5cbmNvbnN0IEVNUFRZX0NISUxEUkVOID0gW107XG5cbi8qKiBKU1gvaHlwZXJzY3JpcHQgcmV2aXZlclxuKlx0QmVuY2htYXJrczogaHR0cHM6Ly9lc2JlbmNoLmNvbS9iZW5jaC81N2VlOGY4ZTMzMGFiMDk5MDBhMWExYTBcbiAqXHRAc2VlIGh0dHA6Ly9qYXNvbmZvcm1hdC5jb20vd3RmLWlzLWpzeFxuICpcdEBwdWJsaWNcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGgobm9kZU5hbWUsIGF0dHJpYnV0ZXMpIHtcblx0bGV0IGNoaWxkcmVuPUVNUFRZX0NISUxEUkVOLCBsYXN0U2ltcGxlLCBjaGlsZCwgc2ltcGxlLCBpO1xuXHRmb3IgKGk9YXJndW1lbnRzLmxlbmd0aDsgaS0tID4gMjsgKSB7XG5cdFx0c3RhY2sucHVzaChhcmd1bWVudHNbaV0pO1xuXHR9XG5cdGlmIChhdHRyaWJ1dGVzICYmIGF0dHJpYnV0ZXMuY2hpbGRyZW4hPW51bGwpIHtcblx0XHRpZiAoIXN0YWNrLmxlbmd0aCkgc3RhY2sucHVzaChhdHRyaWJ1dGVzLmNoaWxkcmVuKTtcblx0XHRkZWxldGUgYXR0cmlidXRlcy5jaGlsZHJlbjtcblx0fVxuXHR3aGlsZSAoc3RhY2subGVuZ3RoKSB7XG5cdFx0aWYgKChjaGlsZCA9IHN0YWNrLnBvcCgpKSAmJiBjaGlsZC5wb3AhPT11bmRlZmluZWQpIHtcblx0XHRcdGZvciAoaT1jaGlsZC5sZW5ndGg7IGktLTsgKSBzdGFjay5wdXNoKGNoaWxkW2ldKTtcblx0XHR9XG5cdFx0ZWxzZSB7XG5cdFx0XHRpZiAoY2hpbGQ9PT10cnVlIHx8IGNoaWxkPT09ZmFsc2UpIGNoaWxkID0gbnVsbDtcblxuXHRcdFx0aWYgKChzaW1wbGUgPSB0eXBlb2Ygbm9kZU5hbWUhPT0nZnVuY3Rpb24nKSkge1xuXHRcdFx0XHRpZiAoY2hpbGQ9PW51bGwpIGNoaWxkID0gJyc7XG5cdFx0XHRcdGVsc2UgaWYgKHR5cGVvZiBjaGlsZD09PSdudW1iZXInKSBjaGlsZCA9IFN0cmluZyhjaGlsZCk7XG5cdFx0XHRcdGVsc2UgaWYgKHR5cGVvZiBjaGlsZCE9PSdzdHJpbmcnKSBzaW1wbGUgPSBmYWxzZTtcblx0XHRcdH1cblxuXHRcdFx0aWYgKHNpbXBsZSAmJiBsYXN0U2ltcGxlKSB7XG5cdFx0XHRcdGNoaWxkcmVuW2NoaWxkcmVuLmxlbmd0aC0xXSArPSBjaGlsZDtcblx0XHRcdH1cblx0XHRcdGVsc2UgaWYgKGNoaWxkcmVuPT09RU1QVFlfQ0hJTERSRU4pIHtcblx0XHRcdFx0Y2hpbGRyZW4gPSBbY2hpbGRdO1xuXHRcdFx0fVxuXHRcdFx0ZWxzZSB7XG5cdFx0XHRcdGNoaWxkcmVuLnB1c2goY2hpbGQpO1xuXHRcdFx0fVxuXG5cdFx0XHRsYXN0U2ltcGxlID0gc2ltcGxlO1xuXHRcdH1cblx0fVxuXG5cdGxldCBwID0gbmV3IFZOb2RlKCk7XG5cdHAubm9kZU5hbWUgPSBub2RlTmFtZTtcblx0cC5jaGlsZHJlbiA9IGNoaWxkcmVuO1xuXHRwLmF0dHJpYnV0ZXMgPSBhdHRyaWJ1dGVzPT1udWxsID8gdW5kZWZpbmVkIDogYXR0cmlidXRlcztcblx0cC5rZXkgPSBhdHRyaWJ1dGVzPT1udWxsID8gdW5kZWZpbmVkIDogYXR0cmlidXRlcy5rZXk7XG5cblx0Ly8gaWYgYSBcInZub2RlIGhvb2tcIiBpcyBkZWZpbmVkLCBwYXNzIGV2ZXJ5IGNyZWF0ZWQgVk5vZGUgdG8gaXRcblx0aWYgKG9wdGlvbnMudm5vZGUhPT11bmRlZmluZWQpIG9wdGlvbnMudm5vZGUocCk7XG5cblx0cmV0dXJuIHA7XG59XG4iLCIvKiogQ29weSBvd24tcHJvcGVydGllcyBmcm9tIGBwcm9wc2Agb250byBgb2JqYC5cbiAqXHRAcmV0dXJucyBvYmpcbiAqXHRAcHJpdmF0ZVxuICovXG5leHBvcnQgZnVuY3Rpb24gZXh0ZW5kKG9iaiwgcHJvcHMpIHtcblx0Zm9yIChsZXQgaSBpbiBwcm9wcykgb2JqW2ldID0gcHJvcHNbaV07XG5cdHJldHVybiBvYmo7XG59XG5cblxuIiwiLy8gcmVuZGVyIG1vZGVzXG5cbmV4cG9ydCBjb25zdCBOT19SRU5ERVIgPSAwO1xuZXhwb3J0IGNvbnN0IFNZTkNfUkVOREVSID0gMTtcbmV4cG9ydCBjb25zdCBGT1JDRV9SRU5ERVIgPSAyO1xuZXhwb3J0IGNvbnN0IEFTWU5DX1JFTkRFUiA9IDM7XG5cblxuZXhwb3J0IGNvbnN0IEFUVFJfS0VZID0gJ19fcHJlYWN0YXR0cl8nO1xuXG4vLyBET00gcHJvcGVydGllcyB0aGF0IHNob3VsZCBOT1QgaGF2ZSBcInB4XCIgYWRkZWQgd2hlbiBudW1lcmljXG5leHBvcnQgY29uc3QgSVNfTk9OX0RJTUVOU0lPTkFMID0gL2FjaXR8ZXgoPzpzfGd8bnxwfCQpfHJwaHxvd3N8bW5jfG50d3xpbmVbY2hdfHpvb3xeb3JkL2k7XG5cbiIsImltcG9ydCBvcHRpb25zIGZyb20gJy4vb3B0aW9ucyc7XG5pbXBvcnQgeyByZW5kZXJDb21wb25lbnQgfSBmcm9tICcuL3Zkb20vY29tcG9uZW50JztcblxuLyoqIE1hbmFnZWQgcXVldWUgb2YgZGlydHkgY29tcG9uZW50cyB0byBiZSByZS1yZW5kZXJlZCAqL1xuXG5sZXQgaXRlbXMgPSBbXTtcblxuZXhwb3J0IGZ1bmN0aW9uIGVucXVldWVSZW5kZXIoY29tcG9uZW50KSB7XG5cdGlmICghY29tcG9uZW50Ll9kaXJ0eSAmJiAoY29tcG9uZW50Ll9kaXJ0eSA9IHRydWUpICYmIGl0ZW1zLnB1c2goY29tcG9uZW50KT09MSkge1xuXHRcdChvcHRpb25zLmRlYm91bmNlUmVuZGVyaW5nIHx8IHNldFRpbWVvdXQpKHJlcmVuZGVyKTtcblx0fVxufVxuXG5cbmV4cG9ydCBmdW5jdGlvbiByZXJlbmRlcigpIHtcblx0bGV0IHAsIGxpc3QgPSBpdGVtcztcblx0aXRlbXMgPSBbXTtcblx0d2hpbGUgKCAocCA9IGxpc3QucG9wKCkpICkge1xuXHRcdGlmIChwLl9kaXJ0eSkgcmVuZGVyQ29tcG9uZW50KHApO1xuXHR9XG59XG4iLCJpbXBvcnQgeyBleHRlbmQgfSBmcm9tICcuLi91dGlsJztcblxuXG4vKiogQ2hlY2sgaWYgdHdvIG5vZGVzIGFyZSBlcXVpdmFsZW50LlxuICpcdEBwYXJhbSB7RWxlbWVudH0gbm9kZVxuICpcdEBwYXJhbSB7Vk5vZGV9IHZub2RlXG4gKlx0QHByaXZhdGVcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGlzU2FtZU5vZGVUeXBlKG5vZGUsIHZub2RlLCBoeWRyYXRpbmcpIHtcblx0aWYgKHR5cGVvZiB2bm9kZT09PSdzdHJpbmcnIHx8IHR5cGVvZiB2bm9kZT09PSdudW1iZXInKSB7XG5cdFx0cmV0dXJuIG5vZGUuc3BsaXRUZXh0IT09dW5kZWZpbmVkO1xuXHR9XG5cdGlmICh0eXBlb2Ygdm5vZGUubm9kZU5hbWU9PT0nc3RyaW5nJykge1xuXHRcdHJldHVybiAhbm9kZS5fY29tcG9uZW50Q29uc3RydWN0b3IgJiYgaXNOYW1lZE5vZGUobm9kZSwgdm5vZGUubm9kZU5hbWUpO1xuXHR9XG5cdHJldHVybiBoeWRyYXRpbmcgfHwgbm9kZS5fY29tcG9uZW50Q29uc3RydWN0b3I9PT12bm9kZS5ub2RlTmFtZTtcbn1cblxuXG4vKiogQ2hlY2sgaWYgYW4gRWxlbWVudCBoYXMgYSBnaXZlbiBub3JtYWxpemVkIG5hbWUuXG4qXHRAcGFyYW0ge0VsZW1lbnR9IG5vZGVcbipcdEBwYXJhbSB7U3RyaW5nfSBub2RlTmFtZVxuICovXG5leHBvcnQgZnVuY3Rpb24gaXNOYW1lZE5vZGUobm9kZSwgbm9kZU5hbWUpIHtcblx0cmV0dXJuIG5vZGUubm9ybWFsaXplZE5vZGVOYW1lPT09bm9kZU5hbWUgfHwgbm9kZS5ub2RlTmFtZS50b0xvd2VyQ2FzZSgpPT09bm9kZU5hbWUudG9Mb3dlckNhc2UoKTtcbn1cblxuXG4vKipcbiAqIFJlY29uc3RydWN0IENvbXBvbmVudC1zdHlsZSBgcHJvcHNgIGZyb20gYSBWTm9kZS5cbiAqIEVuc3VyZXMgZGVmYXVsdC9mYWxsYmFjayB2YWx1ZXMgZnJvbSBgZGVmYXVsdFByb3BzYDpcbiAqIE93bi1wcm9wZXJ0aWVzIG9mIGBkZWZhdWx0UHJvcHNgIG5vdCBwcmVzZW50IGluIGB2bm9kZS5hdHRyaWJ1dGVzYCBhcmUgYWRkZWQuXG4gKiBAcGFyYW0ge1ZOb2RlfSB2bm9kZVxuICogQHJldHVybnMge09iamVjdH0gcHJvcHNcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGdldE5vZGVQcm9wcyh2bm9kZSkge1xuXHRsZXQgcHJvcHMgPSBleHRlbmQoe30sIHZub2RlLmF0dHJpYnV0ZXMpO1xuXHRwcm9wcy5jaGlsZHJlbiA9IHZub2RlLmNoaWxkcmVuO1xuXG5cdGxldCBkZWZhdWx0UHJvcHMgPSB2bm9kZS5ub2RlTmFtZS5kZWZhdWx0UHJvcHM7XG5cdGlmIChkZWZhdWx0UHJvcHMhPT11bmRlZmluZWQpIHtcblx0XHRmb3IgKGxldCBpIGluIGRlZmF1bHRQcm9wcykge1xuXHRcdFx0aWYgKHByb3BzW2ldPT09dW5kZWZpbmVkKSB7XG5cdFx0XHRcdHByb3BzW2ldID0gZGVmYXVsdFByb3BzW2ldO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdHJldHVybiBwcm9wcztcbn1cbiIsImltcG9ydCB7IElTX05PTl9ESU1FTlNJT05BTCB9IGZyb20gJy4uL2NvbnN0YW50cyc7XG5pbXBvcnQgb3B0aW9ucyBmcm9tICcuLi9vcHRpb25zJztcblxuXG4vKiogQ3JlYXRlIGFuIGVsZW1lbnQgd2l0aCB0aGUgZ2l2ZW4gbm9kZU5hbWUuXG4gKlx0QHBhcmFtIHtTdHJpbmd9IG5vZGVOYW1lXG4gKlx0QHBhcmFtIHtCb29sZWFufSBbaXNTdmc9ZmFsc2VdXHRJZiBgdHJ1ZWAsIGNyZWF0ZXMgYW4gZWxlbWVudCB3aXRoaW4gdGhlIFNWRyBuYW1lc3BhY2UuXG4gKlx0QHJldHVybnMge0VsZW1lbnR9IG5vZGVcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZU5vZGUobm9kZU5hbWUsIGlzU3ZnKSB7XG5cdGxldCBub2RlID0gaXNTdmcgPyBkb2N1bWVudC5jcmVhdGVFbGVtZW50TlMoJ2h0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnJywgbm9kZU5hbWUpIDogZG9jdW1lbnQuY3JlYXRlRWxlbWVudChub2RlTmFtZSk7XG5cdG5vZGUubm9ybWFsaXplZE5vZGVOYW1lID0gbm9kZU5hbWU7XG5cdHJldHVybiBub2RlO1xufVxuXG5cbi8qKiBSZW1vdmUgYSBjaGlsZCBub2RlIGZyb20gaXRzIHBhcmVudCBpZiBhdHRhY2hlZC5cbiAqXHRAcGFyYW0ge0VsZW1lbnR9IG5vZGVcdFx0VGhlIG5vZGUgdG8gcmVtb3ZlXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiByZW1vdmVOb2RlKG5vZGUpIHtcblx0aWYgKG5vZGUucGFyZW50Tm9kZSkgbm9kZS5wYXJlbnROb2RlLnJlbW92ZUNoaWxkKG5vZGUpO1xufVxuXG5cbi8qKiBTZXQgYSBuYW1lZCBhdHRyaWJ1dGUgb24gdGhlIGdpdmVuIE5vZGUsIHdpdGggc3BlY2lhbCBiZWhhdmlvciBmb3Igc29tZSBuYW1lcyBhbmQgZXZlbnQgaGFuZGxlcnMuXG4gKlx0SWYgYHZhbHVlYCBpcyBgbnVsbGAsIHRoZSBhdHRyaWJ1dGUvaGFuZGxlciB3aWxsIGJlIHJlbW92ZWQuXG4gKlx0QHBhcmFtIHtFbGVtZW50fSBub2RlXHRBbiBlbGVtZW50IHRvIG11dGF0ZVxuICpcdEBwYXJhbSB7c3RyaW5nfSBuYW1lXHRUaGUgbmFtZS9rZXkgdG8gc2V0LCBzdWNoIGFzIGFuIGV2ZW50IG9yIGF0dHJpYnV0ZSBuYW1lXG4gKlx0QHBhcmFtIHthbnl9IG9sZFx0VGhlIGxhc3QgdmFsdWUgdGhhdCB3YXMgc2V0IGZvciB0aGlzIG5hbWUvbm9kZSBwYWlyXG4gKlx0QHBhcmFtIHthbnl9IHZhbHVlXHRBbiBhdHRyaWJ1dGUgdmFsdWUsIHN1Y2ggYXMgYSBmdW5jdGlvbiB0byBiZSB1c2VkIGFzIGFuIGV2ZW50IGhhbmRsZXJcbiAqXHRAcGFyYW0ge0Jvb2xlYW59IGlzU3ZnXHRBcmUgd2UgY3VycmVudGx5IGRpZmZpbmcgaW5zaWRlIGFuIHN2Zz9cbiAqXHRAcHJpdmF0ZVxuICovXG5leHBvcnQgZnVuY3Rpb24gc2V0QWNjZXNzb3Iobm9kZSwgbmFtZSwgb2xkLCB2YWx1ZSwgaXNTdmcpIHtcblx0aWYgKG5hbWU9PT0nY2xhc3NOYW1lJykgbmFtZSA9ICdjbGFzcyc7XG5cblxuXHRpZiAobmFtZT09PSdrZXknKSB7XG5cdFx0Ly8gaWdub3JlXG5cdH1cblx0ZWxzZSBpZiAobmFtZT09PSdyZWYnKSB7XG5cdFx0aWYgKG9sZCkgb2xkKG51bGwpO1xuXHRcdGlmICh2YWx1ZSkgdmFsdWUobm9kZSk7XG5cdH1cblx0ZWxzZSBpZiAobmFtZT09PSdjbGFzcycgJiYgIWlzU3ZnKSB7XG5cdFx0bm9kZS5jbGFzc05hbWUgPSB2YWx1ZSB8fCAnJztcblx0fVxuXHRlbHNlIGlmIChuYW1lPT09J3N0eWxlJykge1xuXHRcdGlmICghdmFsdWUgfHwgdHlwZW9mIHZhbHVlPT09J3N0cmluZycgfHwgdHlwZW9mIG9sZD09PSdzdHJpbmcnKSB7XG5cdFx0XHRub2RlLnN0eWxlLmNzc1RleHQgPSB2YWx1ZSB8fCAnJztcblx0XHR9XG5cdFx0aWYgKHZhbHVlICYmIHR5cGVvZiB2YWx1ZT09PSdvYmplY3QnKSB7XG5cdFx0XHRpZiAodHlwZW9mIG9sZCE9PSdzdHJpbmcnKSB7XG5cdFx0XHRcdGZvciAobGV0IGkgaW4gb2xkKSBpZiAoIShpIGluIHZhbHVlKSkgbm9kZS5zdHlsZVtpXSA9ICcnO1xuXHRcdFx0fVxuXHRcdFx0Zm9yIChsZXQgaSBpbiB2YWx1ZSkge1xuXHRcdFx0XHRub2RlLnN0eWxlW2ldID0gdHlwZW9mIHZhbHVlW2ldPT09J251bWJlcicgJiYgSVNfTk9OX0RJTUVOU0lPTkFMLnRlc3QoaSk9PT1mYWxzZSA/ICh2YWx1ZVtpXSsncHgnKSA6IHZhbHVlW2ldO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXHRlbHNlIGlmIChuYW1lPT09J2Rhbmdlcm91c2x5U2V0SW5uZXJIVE1MJykge1xuXHRcdGlmICh2YWx1ZSkgbm9kZS5pbm5lckhUTUwgPSB2YWx1ZS5fX2h0bWwgfHwgJyc7XG5cdH1cblx0ZWxzZSBpZiAobmFtZVswXT09J28nICYmIG5hbWVbMV09PSduJykge1xuXHRcdGxldCB1c2VDYXB0dXJlID0gbmFtZSAhPT0gKG5hbWU9bmFtZS5yZXBsYWNlKC9DYXB0dXJlJC8sICcnKSk7XG5cdFx0bmFtZSA9IG5hbWUudG9Mb3dlckNhc2UoKS5zdWJzdHJpbmcoMik7XG5cdFx0aWYgKHZhbHVlKSB7XG5cdFx0XHRpZiAoIW9sZCkgbm9kZS5hZGRFdmVudExpc3RlbmVyKG5hbWUsIGV2ZW50UHJveHksIHVzZUNhcHR1cmUpO1xuXHRcdH1cblx0XHRlbHNlIHtcblx0XHRcdG5vZGUucmVtb3ZlRXZlbnRMaXN0ZW5lcihuYW1lLCBldmVudFByb3h5LCB1c2VDYXB0dXJlKTtcblx0XHR9XG5cdFx0KG5vZGUuX2xpc3RlbmVycyB8fCAobm9kZS5fbGlzdGVuZXJzID0ge30pKVtuYW1lXSA9IHZhbHVlO1xuXHR9XG5cdGVsc2UgaWYgKG5hbWUhPT0nbGlzdCcgJiYgbmFtZSE9PSd0eXBlJyAmJiAhaXNTdmcgJiYgbmFtZSBpbiBub2RlKSB7XG5cdFx0c2V0UHJvcGVydHkobm9kZSwgbmFtZSwgdmFsdWU9PW51bGwgPyAnJyA6IHZhbHVlKTtcblx0XHRpZiAodmFsdWU9PW51bGwgfHwgdmFsdWU9PT1mYWxzZSkgbm9kZS5yZW1vdmVBdHRyaWJ1dGUobmFtZSk7XG5cdH1cblx0ZWxzZSB7XG5cdFx0bGV0IG5zID0gaXNTdmcgJiYgKG5hbWUgIT09IChuYW1lID0gbmFtZS5yZXBsYWNlKC9eeGxpbmtcXDo/LywgJycpKSk7XG5cdFx0aWYgKHZhbHVlPT1udWxsIHx8IHZhbHVlPT09ZmFsc2UpIHtcblx0XHRcdGlmIChucykgbm9kZS5yZW1vdmVBdHRyaWJ1dGVOUygnaHR0cDovL3d3dy53My5vcmcvMTk5OS94bGluaycsIG5hbWUudG9Mb3dlckNhc2UoKSk7XG5cdFx0XHRlbHNlIG5vZGUucmVtb3ZlQXR0cmlidXRlKG5hbWUpO1xuXHRcdH1cblx0XHRlbHNlIGlmICh0eXBlb2YgdmFsdWUhPT0nZnVuY3Rpb24nKSB7XG5cdFx0XHRpZiAobnMpIG5vZGUuc2V0QXR0cmlidXRlTlMoJ2h0dHA6Ly93d3cudzMub3JnLzE5OTkveGxpbmsnLCBuYW1lLnRvTG93ZXJDYXNlKCksIHZhbHVlKTtcblx0XHRcdGVsc2Ugbm9kZS5zZXRBdHRyaWJ1dGUobmFtZSwgdmFsdWUpO1xuXHRcdH1cblx0fVxufVxuXG5cbi8qKiBBdHRlbXB0IHRvIHNldCBhIERPTSBwcm9wZXJ0eSB0byB0aGUgZ2l2ZW4gdmFsdWUuXG4gKlx0SUUgJiBGRiB0aHJvdyBmb3IgY2VydGFpbiBwcm9wZXJ0eS12YWx1ZSBjb21iaW5hdGlvbnMuXG4gKi9cbmZ1bmN0aW9uIHNldFByb3BlcnR5KG5vZGUsIG5hbWUsIHZhbHVlKSB7XG5cdHRyeSB7XG5cdFx0bm9kZVtuYW1lXSA9IHZhbHVlO1xuXHR9IGNhdGNoIChlKSB7IH1cbn1cblxuXG4vKiogUHJveHkgYW4gZXZlbnQgdG8gaG9va2VkIGV2ZW50IGhhbmRsZXJzXG4gKlx0QHByaXZhdGVcbiAqL1xuZnVuY3Rpb24gZXZlbnRQcm94eShlKSB7XG5cdHJldHVybiB0aGlzLl9saXN0ZW5lcnNbZS50eXBlXShvcHRpb25zLmV2ZW50ICYmIG9wdGlvbnMuZXZlbnQoZSkgfHwgZSk7XG59XG4iLCJpbXBvcnQgeyBBVFRSX0tFWSB9IGZyb20gJy4uL2NvbnN0YW50cyc7XG5pbXBvcnQgeyBpc1NhbWVOb2RlVHlwZSwgaXNOYW1lZE5vZGUgfSBmcm9tICcuL2luZGV4JztcbmltcG9ydCB7IGJ1aWxkQ29tcG9uZW50RnJvbVZOb2RlIH0gZnJvbSAnLi9jb21wb25lbnQnO1xuaW1wb3J0IHsgY3JlYXRlTm9kZSwgc2V0QWNjZXNzb3IgfSBmcm9tICcuLi9kb20vaW5kZXgnO1xuaW1wb3J0IHsgdW5tb3VudENvbXBvbmVudCB9IGZyb20gJy4vY29tcG9uZW50JztcbmltcG9ydCBvcHRpb25zIGZyb20gJy4uL29wdGlvbnMnO1xuaW1wb3J0IHsgcmVtb3ZlTm9kZSB9IGZyb20gJy4uL2RvbSc7XG5cbi8qKiBRdWV1ZSBvZiBjb21wb25lbnRzIHRoYXQgaGF2ZSBiZWVuIG1vdW50ZWQgYW5kIGFyZSBhd2FpdGluZyBjb21wb25lbnREaWRNb3VudCAqL1xuZXhwb3J0IGNvbnN0IG1vdW50cyA9IFtdO1xuXG4vKiogRGlmZiByZWN1cnNpb24gY291bnQsIHVzZWQgdG8gdHJhY2sgdGhlIGVuZCBvZiB0aGUgZGlmZiBjeWNsZS4gKi9cbmV4cG9ydCBsZXQgZGlmZkxldmVsID0gMDtcblxuLyoqIEdsb2JhbCBmbGFnIGluZGljYXRpbmcgaWYgdGhlIGRpZmYgaXMgY3VycmVudGx5IHdpdGhpbiBhbiBTVkcgKi9cbmxldCBpc1N2Z01vZGUgPSBmYWxzZTtcblxuLyoqIEdsb2JhbCBmbGFnIGluZGljYXRpbmcgaWYgdGhlIGRpZmYgaXMgcGVyZm9ybWluZyBoeWRyYXRpb24gKi9cbmxldCBoeWRyYXRpbmcgPSBmYWxzZTtcblxuLyoqIEludm9rZSBxdWV1ZWQgY29tcG9uZW50RGlkTW91bnQgbGlmZWN5Y2xlIG1ldGhvZHMgKi9cbmV4cG9ydCBmdW5jdGlvbiBmbHVzaE1vdW50cygpIHtcblx0bGV0IGM7XG5cdHdoaWxlICgoYz1tb3VudHMucG9wKCkpKSB7XG5cdFx0aWYgKG9wdGlvbnMuYWZ0ZXJNb3VudCkgb3B0aW9ucy5hZnRlck1vdW50KGMpO1xuXHRcdGlmIChjLmNvbXBvbmVudERpZE1vdW50KSBjLmNvbXBvbmVudERpZE1vdW50KCk7XG5cdH1cbn1cblxuXG4vKiogQXBwbHkgZGlmZmVyZW5jZXMgaW4gYSBnaXZlbiB2bm9kZSAoYW5kIGl0J3MgZGVlcCBjaGlsZHJlbikgdG8gYSByZWFsIERPTSBOb2RlLlxuICpcdEBwYXJhbSB7RWxlbWVudH0gW2RvbT1udWxsXVx0XHRBIERPTSBub2RlIHRvIG11dGF0ZSBpbnRvIHRoZSBzaGFwZSBvZiB0aGUgYHZub2RlYFxuICpcdEBwYXJhbSB7Vk5vZGV9IHZub2RlXHRcdFx0QSBWTm9kZSAod2l0aCBkZXNjZW5kYW50cyBmb3JtaW5nIGEgdHJlZSkgcmVwcmVzZW50aW5nIHRoZSBkZXNpcmVkIERPTSBzdHJ1Y3R1cmVcbiAqXHRAcmV0dXJucyB7RWxlbWVudH0gZG9tXHRcdFx0VGhlIGNyZWF0ZWQvbXV0YXRlZCBlbGVtZW50XG4gKlx0QHByaXZhdGVcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGRpZmYoZG9tLCB2bm9kZSwgY29udGV4dCwgbW91bnRBbGwsIHBhcmVudCwgY29tcG9uZW50Um9vdCkge1xuXHQvLyBkaWZmTGV2ZWwgaGF2aW5nIGJlZW4gMCBoZXJlIGluZGljYXRlcyBpbml0aWFsIGVudHJ5IGludG8gdGhlIGRpZmYgKG5vdCBhIHN1YmRpZmYpXG5cdGlmICghZGlmZkxldmVsKyspIHtcblx0XHQvLyB3aGVuIGZpcnN0IHN0YXJ0aW5nIHRoZSBkaWZmLCBjaGVjayBpZiB3ZSdyZSBkaWZmaW5nIGFuIFNWRyBvciB3aXRoaW4gYW4gU1ZHXG5cdFx0aXNTdmdNb2RlID0gcGFyZW50IT1udWxsICYmIHBhcmVudC5vd25lclNWR0VsZW1lbnQhPT11bmRlZmluZWQ7XG5cblx0XHQvLyBoeWRyYXRpb24gaXMgaW5pZGljYXRlZCBieSB0aGUgZXhpc3RpbmcgZWxlbWVudCB0byBiZSBkaWZmZWQgbm90IGhhdmluZyBhIHByb3AgY2FjaGVcblx0XHRoeWRyYXRpbmcgPSBkb20hPW51bGwgJiYgIShBVFRSX0tFWSBpbiBkb20pO1xuXHR9XG5cblx0bGV0IHJldCA9IGlkaWZmKGRvbSwgdm5vZGUsIGNvbnRleHQsIG1vdW50QWxsLCBjb21wb25lbnRSb290KTtcblxuXHQvLyBhcHBlbmQgdGhlIGVsZW1lbnQgaWYgaXRzIGEgbmV3IHBhcmVudFxuXHRpZiAocGFyZW50ICYmIHJldC5wYXJlbnROb2RlIT09cGFyZW50KSBwYXJlbnQuYXBwZW5kQ2hpbGQocmV0KTtcblxuXHQvLyBkaWZmTGV2ZWwgYmVpbmcgcmVkdWNlZCB0byAwIG1lYW5zIHdlJ3JlIGV4aXRpbmcgdGhlIGRpZmZcblx0aWYgKCEtLWRpZmZMZXZlbCkge1xuXHRcdGh5ZHJhdGluZyA9IGZhbHNlO1xuXHRcdC8vIGludm9rZSBxdWV1ZWQgY29tcG9uZW50RGlkTW91bnQgbGlmZWN5Y2xlIG1ldGhvZHNcblx0XHRpZiAoIWNvbXBvbmVudFJvb3QpIGZsdXNoTW91bnRzKCk7XG5cdH1cblxuXHRyZXR1cm4gcmV0O1xufVxuXG5cbi8qKiBJbnRlcm5hbHMgb2YgYGRpZmYoKWAsIHNlcGFyYXRlZCB0byBhbGxvdyBieXBhc3NpbmcgZGlmZkxldmVsIC8gbW91bnQgZmx1c2hpbmcuICovXG5mdW5jdGlvbiBpZGlmZihkb20sIHZub2RlLCBjb250ZXh0LCBtb3VudEFsbCwgY29tcG9uZW50Um9vdCkge1xuXHRsZXQgb3V0ID0gZG9tLFxuXHRcdHByZXZTdmdNb2RlID0gaXNTdmdNb2RlO1xuXG5cdC8vIGVtcHR5IHZhbHVlcyAobnVsbCAmIHVuZGVmaW5lZCkgcmVuZGVyIGFzIGVtcHR5IFRleHQgbm9kZXNcblx0aWYgKHZub2RlPT1udWxsKSB2bm9kZSA9ICcnO1xuXG5cblx0Ly8gRmFzdCBjYXNlOiBTdHJpbmdzIGNyZWF0ZS91cGRhdGUgVGV4dCBub2Rlcy5cblx0aWYgKHR5cGVvZiB2bm9kZT09PSdzdHJpbmcnKSB7XG5cblx0XHQvLyB1cGRhdGUgaWYgaXQncyBhbHJlYWR5IGEgVGV4dCBub2RlOlxuXHRcdGlmIChkb20gJiYgZG9tLnNwbGl0VGV4dCE9PXVuZGVmaW5lZCAmJiBkb20ucGFyZW50Tm9kZSAmJiAoIWRvbS5fY29tcG9uZW50IHx8IGNvbXBvbmVudFJvb3QpKSB7XG5cdFx0XHRpZiAoZG9tLm5vZGVWYWx1ZSE9dm5vZGUpIHtcblx0XHRcdFx0ZG9tLm5vZGVWYWx1ZSA9IHZub2RlO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRlbHNlIHtcblx0XHRcdC8vIGl0IHdhc24ndCBhIFRleHQgbm9kZTogcmVwbGFjZSBpdCB3aXRoIG9uZSBhbmQgcmVjeWNsZSB0aGUgb2xkIEVsZW1lbnRcblx0XHRcdG91dCA9IGRvY3VtZW50LmNyZWF0ZVRleHROb2RlKHZub2RlKTtcblx0XHRcdGlmIChkb20pIHtcblx0XHRcdFx0aWYgKGRvbS5wYXJlbnROb2RlKSBkb20ucGFyZW50Tm9kZS5yZXBsYWNlQ2hpbGQob3V0LCBkb20pO1xuXHRcdFx0XHRyZWNvbGxlY3ROb2RlVHJlZShkb20sIHRydWUpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdG91dFtBVFRSX0tFWV0gPSB0cnVlO1xuXG5cdFx0cmV0dXJuIG91dDtcblx0fVxuXG5cblx0Ly8gSWYgdGhlIFZOb2RlIHJlcHJlc2VudHMgYSBDb21wb25lbnQsIHBlcmZvcm0gYSBjb21wb25lbnQgZGlmZjpcblx0aWYgKHR5cGVvZiB2bm9kZS5ub2RlTmFtZT09PSdmdW5jdGlvbicpIHtcblx0XHRyZXR1cm4gYnVpbGRDb21wb25lbnRGcm9tVk5vZGUoZG9tLCB2bm9kZSwgY29udGV4dCwgbW91bnRBbGwpO1xuXHR9XG5cblxuXHQvLyBUcmFja3MgZW50ZXJpbmcgYW5kIGV4aXRpbmcgU1ZHIG5hbWVzcGFjZSB3aGVuIGRlc2NlbmRpbmcgdGhyb3VnaCB0aGUgdHJlZS5cblx0aXNTdmdNb2RlID0gdm5vZGUubm9kZU5hbWU9PT0nc3ZnJyA/IHRydWUgOiB2bm9kZS5ub2RlTmFtZT09PSdmb3JlaWduT2JqZWN0JyA/IGZhbHNlIDogaXNTdmdNb2RlO1xuXG5cblx0Ly8gSWYgdGhlcmUncyBubyBleGlzdGluZyBlbGVtZW50IG9yIGl0J3MgdGhlIHdyb25nIHR5cGUsIGNyZWF0ZSBhIG5ldyBvbmU6XG5cdGlmICghZG9tIHx8ICFpc05hbWVkTm9kZShkb20sIFN0cmluZyh2bm9kZS5ub2RlTmFtZSkpKSB7XG5cdFx0b3V0ID0gY3JlYXRlTm9kZShTdHJpbmcodm5vZGUubm9kZU5hbWUpLCBpc1N2Z01vZGUpO1xuXG5cdFx0aWYgKGRvbSkge1xuXHRcdFx0Ly8gbW92ZSBjaGlsZHJlbiBpbnRvIHRoZSByZXBsYWNlbWVudCBub2RlXG5cdFx0XHR3aGlsZSAoZG9tLmZpcnN0Q2hpbGQpIG91dC5hcHBlbmRDaGlsZChkb20uZmlyc3RDaGlsZCk7XG5cblx0XHRcdC8vIGlmIHRoZSBwcmV2aW91cyBFbGVtZW50IHdhcyBtb3VudGVkIGludG8gdGhlIERPTSwgcmVwbGFjZSBpdCBpbmxpbmVcblx0XHRcdGlmIChkb20ucGFyZW50Tm9kZSkgZG9tLnBhcmVudE5vZGUucmVwbGFjZUNoaWxkKG91dCwgZG9tKTtcblxuXHRcdFx0Ly8gcmVjeWNsZSB0aGUgb2xkIGVsZW1lbnQgKHNraXBzIG5vbi1FbGVtZW50IG5vZGUgdHlwZXMpXG5cdFx0XHRyZWNvbGxlY3ROb2RlVHJlZShkb20sIHRydWUpO1xuXHRcdH1cblx0fVxuXG5cblx0bGV0IGZjID0gb3V0LmZpcnN0Q2hpbGQsXG5cdFx0cHJvcHMgPSBvdXRbQVRUUl9LRVldIHx8IChvdXRbQVRUUl9LRVldID0ge30pLFxuXHRcdHZjaGlsZHJlbiA9IHZub2RlLmNoaWxkcmVuO1xuXG5cdC8vIE9wdGltaXphdGlvbjogZmFzdC1wYXRoIGZvciBlbGVtZW50cyBjb250YWluaW5nIGEgc2luZ2xlIFRleHROb2RlOlxuXHRpZiAoIWh5ZHJhdGluZyAmJiB2Y2hpbGRyZW4gJiYgdmNoaWxkcmVuLmxlbmd0aD09PTEgJiYgdHlwZW9mIHZjaGlsZHJlblswXT09PSdzdHJpbmcnICYmIGZjIT1udWxsICYmIGZjLnNwbGl0VGV4dCE9PXVuZGVmaW5lZCAmJiBmYy5uZXh0U2libGluZz09bnVsbCkge1xuXHRcdGlmIChmYy5ub2RlVmFsdWUhPXZjaGlsZHJlblswXSkge1xuXHRcdFx0ZmMubm9kZVZhbHVlID0gdmNoaWxkcmVuWzBdO1xuXHRcdH1cblx0fVxuXHQvLyBvdGhlcndpc2UsIGlmIHRoZXJlIGFyZSBleGlzdGluZyBvciBuZXcgY2hpbGRyZW4sIGRpZmYgdGhlbTpcblx0ZWxzZSBpZiAodmNoaWxkcmVuICYmIHZjaGlsZHJlbi5sZW5ndGggfHwgZmMhPW51bGwpIHtcblx0XHRpbm5lckRpZmZOb2RlKG91dCwgdmNoaWxkcmVuLCBjb250ZXh0LCBtb3VudEFsbCwgaHlkcmF0aW5nIHx8IHByb3BzLmRhbmdlcm91c2x5U2V0SW5uZXJIVE1MIT1udWxsKTtcblx0fVxuXG5cblx0Ly8gQXBwbHkgYXR0cmlidXRlcy9wcm9wcyBmcm9tIFZOb2RlIHRvIHRoZSBET00gRWxlbWVudDpcblx0ZGlmZkF0dHJpYnV0ZXMob3V0LCB2bm9kZS5hdHRyaWJ1dGVzLCBwcm9wcyk7XG5cblxuXHQvLyByZXN0b3JlIHByZXZpb3VzIFNWRyBtb2RlOiAoaW4gY2FzZSB3ZSdyZSBleGl0aW5nIGFuIFNWRyBuYW1lc3BhY2UpXG5cdGlzU3ZnTW9kZSA9IHByZXZTdmdNb2RlO1xuXG5cdHJldHVybiBvdXQ7XG59XG5cblxuLyoqIEFwcGx5IGNoaWxkIGFuZCBhdHRyaWJ1dGUgY2hhbmdlcyBiZXR3ZWVuIGEgVk5vZGUgYW5kIGEgRE9NIE5vZGUgdG8gdGhlIERPTS5cbiAqXHRAcGFyYW0ge0VsZW1lbnR9IGRvbVx0XHRcdEVsZW1lbnQgd2hvc2UgY2hpbGRyZW4gc2hvdWxkIGJlIGNvbXBhcmVkICYgbXV0YXRlZFxuICpcdEBwYXJhbSB7QXJyYXl9IHZjaGlsZHJlblx0XHRBcnJheSBvZiBWTm9kZXMgdG8gY29tcGFyZSB0byBgZG9tLmNoaWxkTm9kZXNgXG4gKlx0QHBhcmFtIHtPYmplY3R9IGNvbnRleHRcdFx0XHRJbXBsaWNpdGx5IGRlc2NlbmRhbnQgY29udGV4dCBvYmplY3QgKGZyb20gbW9zdCByZWNlbnQgYGdldENoaWxkQ29udGV4dCgpYClcbiAqXHRAcGFyYW0ge0Jvb2xlYW59IG1vdW50QWxsXG4gKlx0QHBhcmFtIHtCb29sZWFufSBpc0h5ZHJhdGluZ1x0SWYgYHRydWVgLCBjb25zdW1lcyBleHRlcm5hbGx5IGNyZWF0ZWQgZWxlbWVudHMgc2ltaWxhciB0byBoeWRyYXRpb25cbiAqL1xuZnVuY3Rpb24gaW5uZXJEaWZmTm9kZShkb20sIHZjaGlsZHJlbiwgY29udGV4dCwgbW91bnRBbGwsIGlzSHlkcmF0aW5nKSB7XG5cdGxldCBvcmlnaW5hbENoaWxkcmVuID0gZG9tLmNoaWxkTm9kZXMsXG5cdFx0Y2hpbGRyZW4gPSBbXSxcblx0XHRrZXllZCA9IHt9LFxuXHRcdGtleWVkTGVuID0gMCxcblx0XHRtaW4gPSAwLFxuXHRcdGxlbiA9IG9yaWdpbmFsQ2hpbGRyZW4ubGVuZ3RoLFxuXHRcdGNoaWxkcmVuTGVuID0gMCxcblx0XHR2bGVuID0gdmNoaWxkcmVuID8gdmNoaWxkcmVuLmxlbmd0aCA6IDAsXG5cdFx0aiwgYywgdmNoaWxkLCBjaGlsZDtcblxuXHQvLyBCdWlsZCB1cCBhIG1hcCBvZiBrZXllZCBjaGlsZHJlbiBhbmQgYW4gQXJyYXkgb2YgdW5rZXllZCBjaGlsZHJlbjpcblx0aWYgKGxlbiE9PTApIHtcblx0XHRmb3IgKGxldCBpPTA7IGk8bGVuOyBpKyspIHtcblx0XHRcdGxldCBjaGlsZCA9IG9yaWdpbmFsQ2hpbGRyZW5baV0sXG5cdFx0XHRcdHByb3BzID0gY2hpbGRbQVRUUl9LRVldLFxuXHRcdFx0XHRrZXkgPSB2bGVuICYmIHByb3BzID8gY2hpbGQuX2NvbXBvbmVudCA/IGNoaWxkLl9jb21wb25lbnQuX19rZXkgOiBwcm9wcy5rZXkgOiBudWxsO1xuXHRcdFx0aWYgKGtleSE9bnVsbCkge1xuXHRcdFx0XHRrZXllZExlbisrO1xuXHRcdFx0XHRrZXllZFtrZXldID0gY2hpbGQ7XG5cdFx0XHR9XG5cdFx0XHRlbHNlIGlmIChwcm9wcyB8fCAoY2hpbGQuc3BsaXRUZXh0IT09dW5kZWZpbmVkID8gKGlzSHlkcmF0aW5nID8gY2hpbGQubm9kZVZhbHVlLnRyaW0oKSA6IHRydWUpIDogaXNIeWRyYXRpbmcpKSB7XG5cdFx0XHRcdGNoaWxkcmVuW2NoaWxkcmVuTGVuKytdID0gY2hpbGQ7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0aWYgKHZsZW4hPT0wKSB7XG5cdFx0Zm9yIChsZXQgaT0wOyBpPHZsZW47IGkrKykge1xuXHRcdFx0dmNoaWxkID0gdmNoaWxkcmVuW2ldO1xuXHRcdFx0Y2hpbGQgPSBudWxsO1xuXG5cdFx0XHQvLyBhdHRlbXB0IHRvIGZpbmQgYSBub2RlIGJhc2VkIG9uIGtleSBtYXRjaGluZ1xuXHRcdFx0bGV0IGtleSA9IHZjaGlsZC5rZXk7XG5cdFx0XHRpZiAoa2V5IT1udWxsKSB7XG5cdFx0XHRcdGlmIChrZXllZExlbiAmJiBrZXllZFtrZXldIT09dW5kZWZpbmVkKSB7XG5cdFx0XHRcdFx0Y2hpbGQgPSBrZXllZFtrZXldO1xuXHRcdFx0XHRcdGtleWVkW2tleV0gPSB1bmRlZmluZWQ7XG5cdFx0XHRcdFx0a2V5ZWRMZW4tLTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0Ly8gYXR0ZW1wdCB0byBwbHVjayBhIG5vZGUgb2YgdGhlIHNhbWUgdHlwZSBmcm9tIHRoZSBleGlzdGluZyBjaGlsZHJlblxuXHRcdFx0ZWxzZSBpZiAoIWNoaWxkICYmIG1pbjxjaGlsZHJlbkxlbikge1xuXHRcdFx0XHRmb3IgKGo9bWluOyBqPGNoaWxkcmVuTGVuOyBqKyspIHtcblx0XHRcdFx0XHRpZiAoY2hpbGRyZW5bal0hPT11bmRlZmluZWQgJiYgaXNTYW1lTm9kZVR5cGUoYyA9IGNoaWxkcmVuW2pdLCB2Y2hpbGQsIGlzSHlkcmF0aW5nKSkge1xuXHRcdFx0XHRcdFx0Y2hpbGQgPSBjO1xuXHRcdFx0XHRcdFx0Y2hpbGRyZW5bal0gPSB1bmRlZmluZWQ7XG5cdFx0XHRcdFx0XHRpZiAoaj09PWNoaWxkcmVuTGVuLTEpIGNoaWxkcmVuTGVuLS07XG5cdFx0XHRcdFx0XHRpZiAoaj09PW1pbikgbWluKys7XG5cdFx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0Ly8gbW9ycGggdGhlIG1hdGNoZWQvZm91bmQvY3JlYXRlZCBET00gY2hpbGQgdG8gbWF0Y2ggdmNoaWxkIChkZWVwKVxuXHRcdFx0Y2hpbGQgPSBpZGlmZihjaGlsZCwgdmNoaWxkLCBjb250ZXh0LCBtb3VudEFsbCk7XG5cblx0XHRcdGlmIChjaGlsZCAmJiBjaGlsZCE9PWRvbSkge1xuXHRcdFx0XHRpZiAoaT49bGVuKSB7XG5cdFx0XHRcdFx0ZG9tLmFwcGVuZENoaWxkKGNoaWxkKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRlbHNlIGlmIChjaGlsZCE9PW9yaWdpbmFsQ2hpbGRyZW5baV0pIHtcblx0XHRcdFx0XHRpZiAoY2hpbGQ9PT1vcmlnaW5hbENoaWxkcmVuW2krMV0pIHtcblx0XHRcdFx0XHRcdHJlbW92ZU5vZGUob3JpZ2luYWxDaGlsZHJlbltpXSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGVsc2Uge1xuXHRcdFx0XHRcdFx0ZG9tLmluc2VydEJlZm9yZShjaGlsZCwgb3JpZ2luYWxDaGlsZHJlbltpXSB8fCBudWxsKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXG5cdC8vIHJlbW92ZSB1bnVzZWQga2V5ZWQgY2hpbGRyZW46XG5cdGlmIChrZXllZExlbikge1xuXHRcdGZvciAobGV0IGkgaW4ga2V5ZWQpIGlmIChrZXllZFtpXSE9PXVuZGVmaW5lZCkgcmVjb2xsZWN0Tm9kZVRyZWUoa2V5ZWRbaV0sIGZhbHNlKTtcblx0fVxuXG5cdC8vIHJlbW92ZSBvcnBoYW5lZCB1bmtleWVkIGNoaWxkcmVuOlxuXHR3aGlsZSAobWluPD1jaGlsZHJlbkxlbikge1xuXHRcdGlmICgoY2hpbGQgPSBjaGlsZHJlbltjaGlsZHJlbkxlbi0tXSkhPT11bmRlZmluZWQpIHJlY29sbGVjdE5vZGVUcmVlKGNoaWxkLCBmYWxzZSk7XG5cdH1cbn1cblxuXG5cbi8qKiBSZWN1cnNpdmVseSByZWN5Y2xlIChvciBqdXN0IHVubW91bnQpIGEgbm9kZSBhbiBpdHMgZGVzY2VuZGFudHMuXG4gKlx0QHBhcmFtIHtOb2RlfSBub2RlXHRcdFx0XHRcdFx0RE9NIG5vZGUgdG8gc3RhcnQgdW5tb3VudC9yZW1vdmFsIGZyb21cbiAqXHRAcGFyYW0ge0Jvb2xlYW59IFt1bm1vdW50T25seT1mYWxzZV1cdElmIGB0cnVlYCwgb25seSB0cmlnZ2VycyB1bm1vdW50IGxpZmVjeWNsZSwgc2tpcHMgcmVtb3ZhbFxuICovXG5leHBvcnQgZnVuY3Rpb24gcmVjb2xsZWN0Tm9kZVRyZWUobm9kZSwgdW5tb3VudE9ubHkpIHtcblx0bGV0IGNvbXBvbmVudCA9IG5vZGUuX2NvbXBvbmVudDtcblx0aWYgKGNvbXBvbmVudCkge1xuXHRcdC8vIGlmIG5vZGUgaXMgb3duZWQgYnkgYSBDb21wb25lbnQsIHVubW91bnQgdGhhdCBjb21wb25lbnQgKGVuZHMgdXAgcmVjdXJzaW5nIGJhY2sgaGVyZSlcblx0XHR1bm1vdW50Q29tcG9uZW50KGNvbXBvbmVudCk7XG5cdH1cblx0ZWxzZSB7XG5cdFx0Ly8gSWYgdGhlIG5vZGUncyBWTm9kZSBoYWQgYSByZWYgZnVuY3Rpb24sIGludm9rZSBpdCB3aXRoIG51bGwgaGVyZS5cblx0XHQvLyAodGhpcyBpcyBwYXJ0IG9mIHRoZSBSZWFjdCBzcGVjLCBhbmQgc21hcnQgZm9yIHVuc2V0dGluZyByZWZlcmVuY2VzKVxuXHRcdGlmIChub2RlW0FUVFJfS0VZXSE9bnVsbCAmJiBub2RlW0FUVFJfS0VZXS5yZWYpIG5vZGVbQVRUUl9LRVldLnJlZihudWxsKTtcblxuXHRcdGlmICh1bm1vdW50T25seT09PWZhbHNlIHx8IG5vZGVbQVRUUl9LRVldPT1udWxsKSB7XG5cdFx0XHRyZW1vdmVOb2RlKG5vZGUpO1xuXHRcdH1cblxuXHRcdHJlbW92ZUNoaWxkcmVuKG5vZGUpO1xuXHR9XG59XG5cblxuLyoqIFJlY29sbGVjdC91bm1vdW50IGFsbCBjaGlsZHJlbi5cbiAqXHQtIHdlIHVzZSAubGFzdENoaWxkIGhlcmUgYmVjYXVzZSBpdCBjYXVzZXMgbGVzcyByZWZsb3cgdGhhbiAuZmlyc3RDaGlsZFxuICpcdC0gaXQncyBhbHNvIGNoZWFwZXIgdGhhbiBhY2Nlc3NpbmcgdGhlIC5jaGlsZE5vZGVzIExpdmUgTm9kZUxpc3RcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHJlbW92ZUNoaWxkcmVuKG5vZGUpIHtcblx0bm9kZSA9IG5vZGUubGFzdENoaWxkO1xuXHR3aGlsZSAobm9kZSkge1xuXHRcdGxldCBuZXh0ID0gbm9kZS5wcmV2aW91c1NpYmxpbmc7XG5cdFx0cmVjb2xsZWN0Tm9kZVRyZWUobm9kZSwgdHJ1ZSk7XG5cdFx0bm9kZSA9IG5leHQ7XG5cdH1cbn1cblxuXG4vKiogQXBwbHkgZGlmZmVyZW5jZXMgaW4gYXR0cmlidXRlcyBmcm9tIGEgVk5vZGUgdG8gdGhlIGdpdmVuIERPTSBFbGVtZW50LlxuICpcdEBwYXJhbSB7RWxlbWVudH0gZG9tXHRcdEVsZW1lbnQgd2l0aCBhdHRyaWJ1dGVzIHRvIGRpZmYgYGF0dHJzYCBhZ2FpbnN0XG4gKlx0QHBhcmFtIHtPYmplY3R9IGF0dHJzXHRcdFRoZSBkZXNpcmVkIGVuZC1zdGF0ZSBrZXktdmFsdWUgYXR0cmlidXRlIHBhaXJzXG4gKlx0QHBhcmFtIHtPYmplY3R9IG9sZFx0XHRcdEN1cnJlbnQvcHJldmlvdXMgYXR0cmlidXRlcyAoZnJvbSBwcmV2aW91cyBWTm9kZSBvciBlbGVtZW50J3MgcHJvcCBjYWNoZSlcbiAqL1xuZnVuY3Rpb24gZGlmZkF0dHJpYnV0ZXMoZG9tLCBhdHRycywgb2xkKSB7XG5cdGxldCBuYW1lO1xuXG5cdC8vIHJlbW92ZSBhdHRyaWJ1dGVzIG5vIGxvbmdlciBwcmVzZW50IG9uIHRoZSB2bm9kZSBieSBzZXR0aW5nIHRoZW0gdG8gdW5kZWZpbmVkXG5cdGZvciAobmFtZSBpbiBvbGQpIHtcblx0XHRpZiAoIShhdHRycyAmJiBhdHRyc1tuYW1lXSE9bnVsbCkgJiYgb2xkW25hbWVdIT1udWxsKSB7XG5cdFx0XHRzZXRBY2Nlc3Nvcihkb20sIG5hbWUsIG9sZFtuYW1lXSwgb2xkW25hbWVdID0gdW5kZWZpbmVkLCBpc1N2Z01vZGUpO1xuXHRcdH1cblx0fVxuXG5cdC8vIGFkZCBuZXcgJiB1cGRhdGUgY2hhbmdlZCBhdHRyaWJ1dGVzXG5cdGZvciAobmFtZSBpbiBhdHRycykge1xuXHRcdGlmIChuYW1lIT09J2NoaWxkcmVuJyAmJiBuYW1lIT09J2lubmVySFRNTCcgJiYgKCEobmFtZSBpbiBvbGQpIHx8IGF0dHJzW25hbWVdIT09KG5hbWU9PT0ndmFsdWUnIHx8IG5hbWU9PT0nY2hlY2tlZCcgPyBkb21bbmFtZV0gOiBvbGRbbmFtZV0pKSkge1xuXHRcdFx0c2V0QWNjZXNzb3IoZG9tLCBuYW1lLCBvbGRbbmFtZV0sIG9sZFtuYW1lXSA9IGF0dHJzW25hbWVdLCBpc1N2Z01vZGUpO1xuXHRcdH1cblx0fVxufVxuIiwiaW1wb3J0IHsgQ29tcG9uZW50IH0gZnJvbSAnLi4vY29tcG9uZW50JztcblxuLyoqIFJldGFpbnMgYSBwb29sIG9mIENvbXBvbmVudHMgZm9yIHJlLXVzZSwga2V5ZWQgb24gY29tcG9uZW50IG5hbWUuXG4gKlx0Tm90ZTogc2luY2UgY29tcG9uZW50IG5hbWVzIGFyZSBub3QgdW5pcXVlIG9yIGV2ZW4gbmVjZXNzYXJpbHkgYXZhaWxhYmxlLCB0aGVzZSBhcmUgcHJpbWFyaWx5IGEgZm9ybSBvZiBzaGFyZGluZy5cbiAqXHRAcHJpdmF0ZVxuICovXG5jb25zdCBjb21wb25lbnRzID0ge307XG5cblxuLyoqIFJlY2xhaW0gYSBjb21wb25lbnQgZm9yIGxhdGVyIHJlLXVzZSBieSB0aGUgcmVjeWNsZXIuICovXG5leHBvcnQgZnVuY3Rpb24gY29sbGVjdENvbXBvbmVudChjb21wb25lbnQpIHtcblx0bGV0IG5hbWUgPSBjb21wb25lbnQuY29uc3RydWN0b3IubmFtZTtcblx0KGNvbXBvbmVudHNbbmFtZV0gfHwgKGNvbXBvbmVudHNbbmFtZV0gPSBbXSkpLnB1c2goY29tcG9uZW50KTtcbn1cblxuXG4vKiogQ3JlYXRlIGEgY29tcG9uZW50LiBOb3JtYWxpemVzIGRpZmZlcmVuY2VzIGJldHdlZW4gUEZDJ3MgYW5kIGNsYXNzZnVsIENvbXBvbmVudHMuICovXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlQ29tcG9uZW50KEN0b3IsIHByb3BzLCBjb250ZXh0KSB7XG5cdGxldCBsaXN0ID0gY29tcG9uZW50c1tDdG9yLm5hbWVdLFxuXHRcdGluc3Q7XG5cblx0aWYgKEN0b3IucHJvdG90eXBlICYmIEN0b3IucHJvdG90eXBlLnJlbmRlcikge1xuXHRcdGluc3QgPSBuZXcgQ3Rvcihwcm9wcywgY29udGV4dCk7XG5cdFx0Q29tcG9uZW50LmNhbGwoaW5zdCwgcHJvcHMsIGNvbnRleHQpO1xuXHR9XG5cdGVsc2Uge1xuXHRcdGluc3QgPSBuZXcgQ29tcG9uZW50KHByb3BzLCBjb250ZXh0KTtcblx0XHRpbnN0LmNvbnN0cnVjdG9yID0gQ3Rvcjtcblx0XHRpbnN0LnJlbmRlciA9IGRvUmVuZGVyO1xuXHR9XG5cblxuXHRpZiAobGlzdCkge1xuXHRcdGZvciAobGV0IGk9bGlzdC5sZW5ndGg7IGktLTsgKSB7XG5cdFx0XHRpZiAobGlzdFtpXS5jb25zdHJ1Y3Rvcj09PUN0b3IpIHtcblx0XHRcdFx0aW5zdC5uZXh0QmFzZSA9IGxpc3RbaV0ubmV4dEJhc2U7XG5cdFx0XHRcdGxpc3Quc3BsaWNlKGksIDEpO1xuXHRcdFx0XHRicmVhaztcblx0XHRcdH1cblx0XHR9XG5cdH1cblx0cmV0dXJuIGluc3Q7XG59XG5cblxuLyoqIFRoZSBgLnJlbmRlcigpYCBtZXRob2QgZm9yIGEgUEZDIGJhY2tpbmcgaW5zdGFuY2UuICovXG5mdW5jdGlvbiBkb1JlbmRlcihwcm9wcywgc3RhdGUsIGNvbnRleHQpIHtcblx0cmV0dXJuIHRoaXMuY29uc3RydWN0b3IocHJvcHMsIGNvbnRleHQpO1xufVxuIiwiaW1wb3J0IHsgU1lOQ19SRU5ERVIsIE5PX1JFTkRFUiwgRk9SQ0VfUkVOREVSLCBBU1lOQ19SRU5ERVIsIEFUVFJfS0VZIH0gZnJvbSAnLi4vY29uc3RhbnRzJztcbmltcG9ydCBvcHRpb25zIGZyb20gJy4uL29wdGlvbnMnO1xuaW1wb3J0IHsgZXh0ZW5kIH0gZnJvbSAnLi4vdXRpbCc7XG5pbXBvcnQgeyBlbnF1ZXVlUmVuZGVyIH0gZnJvbSAnLi4vcmVuZGVyLXF1ZXVlJztcbmltcG9ydCB7IGdldE5vZGVQcm9wcyB9IGZyb20gJy4vaW5kZXgnO1xuaW1wb3J0IHsgZGlmZiwgbW91bnRzLCBkaWZmTGV2ZWwsIGZsdXNoTW91bnRzLCByZWNvbGxlY3ROb2RlVHJlZSwgcmVtb3ZlQ2hpbGRyZW4gfSBmcm9tICcuL2RpZmYnO1xuaW1wb3J0IHsgY3JlYXRlQ29tcG9uZW50LCBjb2xsZWN0Q29tcG9uZW50IH0gZnJvbSAnLi9jb21wb25lbnQtcmVjeWNsZXInO1xuaW1wb3J0IHsgcmVtb3ZlTm9kZSB9IGZyb20gJy4uL2RvbSc7XG5cbi8qKiBTZXQgYSBjb21wb25lbnQncyBgcHJvcHNgIChnZW5lcmFsbHkgZGVyaXZlZCBmcm9tIEpTWCBhdHRyaWJ1dGVzKS5cbiAqXHRAcGFyYW0ge09iamVjdH0gcHJvcHNcbiAqXHRAcGFyYW0ge09iamVjdH0gW29wdHNdXG4gKlx0QHBhcmFtIHtib29sZWFufSBbb3B0cy5yZW5kZXJTeW5jPWZhbHNlXVx0SWYgYHRydWVgIGFuZCB7QGxpbmsgb3B0aW9ucy5zeW5jQ29tcG9uZW50VXBkYXRlc30gaXMgYHRydWVgLCB0cmlnZ2VycyBzeW5jaHJvbm91cyByZW5kZXJpbmcuXG4gKlx0QHBhcmFtIHtib29sZWFufSBbb3B0cy5yZW5kZXI9dHJ1ZV1cdFx0XHRJZiBgZmFsc2VgLCBubyByZW5kZXIgd2lsbCBiZSB0cmlnZ2VyZWQuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBzZXRDb21wb25lbnRQcm9wcyhjb21wb25lbnQsIHByb3BzLCBvcHRzLCBjb250ZXh0LCBtb3VudEFsbCkge1xuXHRpZiAoY29tcG9uZW50Ll9kaXNhYmxlKSByZXR1cm47XG5cdGNvbXBvbmVudC5fZGlzYWJsZSA9IHRydWU7XG5cblx0aWYgKChjb21wb25lbnQuX19yZWYgPSBwcm9wcy5yZWYpKSBkZWxldGUgcHJvcHMucmVmO1xuXHRpZiAoKGNvbXBvbmVudC5fX2tleSA9IHByb3BzLmtleSkpIGRlbGV0ZSBwcm9wcy5rZXk7XG5cblx0aWYgKCFjb21wb25lbnQuYmFzZSB8fCBtb3VudEFsbCkge1xuXHRcdGlmIChjb21wb25lbnQuY29tcG9uZW50V2lsbE1vdW50KSBjb21wb25lbnQuY29tcG9uZW50V2lsbE1vdW50KCk7XG5cdH1cblx0ZWxzZSBpZiAoY29tcG9uZW50LmNvbXBvbmVudFdpbGxSZWNlaXZlUHJvcHMpIHtcblx0XHRjb21wb25lbnQuY29tcG9uZW50V2lsbFJlY2VpdmVQcm9wcyhwcm9wcywgY29udGV4dCk7XG5cdH1cblxuXHRpZiAoY29udGV4dCAmJiBjb250ZXh0IT09Y29tcG9uZW50LmNvbnRleHQpIHtcblx0XHRpZiAoIWNvbXBvbmVudC5wcmV2Q29udGV4dCkgY29tcG9uZW50LnByZXZDb250ZXh0ID0gY29tcG9uZW50LmNvbnRleHQ7XG5cdFx0Y29tcG9uZW50LmNvbnRleHQgPSBjb250ZXh0O1xuXHR9XG5cblx0aWYgKCFjb21wb25lbnQucHJldlByb3BzKSBjb21wb25lbnQucHJldlByb3BzID0gY29tcG9uZW50LnByb3BzO1xuXHRjb21wb25lbnQucHJvcHMgPSBwcm9wcztcblxuXHRjb21wb25lbnQuX2Rpc2FibGUgPSBmYWxzZTtcblxuXHRpZiAob3B0cyE9PU5PX1JFTkRFUikge1xuXHRcdGlmIChvcHRzPT09U1lOQ19SRU5ERVIgfHwgb3B0aW9ucy5zeW5jQ29tcG9uZW50VXBkYXRlcyE9PWZhbHNlIHx8ICFjb21wb25lbnQuYmFzZSkge1xuXHRcdFx0cmVuZGVyQ29tcG9uZW50KGNvbXBvbmVudCwgU1lOQ19SRU5ERVIsIG1vdW50QWxsKTtcblx0XHR9XG5cdFx0ZWxzZSB7XG5cdFx0XHRlbnF1ZXVlUmVuZGVyKGNvbXBvbmVudCk7XG5cdFx0fVxuXHR9XG5cblx0aWYgKGNvbXBvbmVudC5fX3JlZikgY29tcG9uZW50Ll9fcmVmKGNvbXBvbmVudCk7XG59XG5cblxuXG4vKiogUmVuZGVyIGEgQ29tcG9uZW50LCB0cmlnZ2VyaW5nIG5lY2Vzc2FyeSBsaWZlY3ljbGUgZXZlbnRzIGFuZCB0YWtpbmcgSGlnaC1PcmRlciBDb21wb25lbnRzIGludG8gYWNjb3VudC5cbiAqXHRAcGFyYW0ge0NvbXBvbmVudH0gY29tcG9uZW50XG4gKlx0QHBhcmFtIHtPYmplY3R9IFtvcHRzXVxuICpcdEBwYXJhbSB7Ym9vbGVhbn0gW29wdHMuYnVpbGQ9ZmFsc2VdXHRcdElmIGB0cnVlYCwgY29tcG9uZW50IHdpbGwgYnVpbGQgYW5kIHN0b3JlIGEgRE9NIG5vZGUgaWYgbm90IGFscmVhZHkgYXNzb2NpYXRlZCB3aXRoIG9uZS5cbiAqXHRAcHJpdmF0ZVxuICovXG5leHBvcnQgZnVuY3Rpb24gcmVuZGVyQ29tcG9uZW50KGNvbXBvbmVudCwgb3B0cywgbW91bnRBbGwsIGlzQ2hpbGQpIHtcblx0aWYgKGNvbXBvbmVudC5fZGlzYWJsZSkgcmV0dXJuO1xuXG5cdGxldCBwcm9wcyA9IGNvbXBvbmVudC5wcm9wcyxcblx0XHRzdGF0ZSA9IGNvbXBvbmVudC5zdGF0ZSxcblx0XHRjb250ZXh0ID0gY29tcG9uZW50LmNvbnRleHQsXG5cdFx0cHJldmlvdXNQcm9wcyA9IGNvbXBvbmVudC5wcmV2UHJvcHMgfHwgcHJvcHMsXG5cdFx0cHJldmlvdXNTdGF0ZSA9IGNvbXBvbmVudC5wcmV2U3RhdGUgfHwgc3RhdGUsXG5cdFx0cHJldmlvdXNDb250ZXh0ID0gY29tcG9uZW50LnByZXZDb250ZXh0IHx8IGNvbnRleHQsXG5cdFx0aXNVcGRhdGUgPSBjb21wb25lbnQuYmFzZSxcblx0XHRuZXh0QmFzZSA9IGNvbXBvbmVudC5uZXh0QmFzZSxcblx0XHRpbml0aWFsQmFzZSA9IGlzVXBkYXRlIHx8IG5leHRCYXNlLFxuXHRcdGluaXRpYWxDaGlsZENvbXBvbmVudCA9IGNvbXBvbmVudC5fY29tcG9uZW50LFxuXHRcdHNraXAgPSBmYWxzZSxcblx0XHRyZW5kZXJlZCwgaW5zdCwgY2Jhc2U7XG5cblx0Ly8gaWYgdXBkYXRpbmdcblx0aWYgKGlzVXBkYXRlKSB7XG5cdFx0Y29tcG9uZW50LnByb3BzID0gcHJldmlvdXNQcm9wcztcblx0XHRjb21wb25lbnQuc3RhdGUgPSBwcmV2aW91c1N0YXRlO1xuXHRcdGNvbXBvbmVudC5jb250ZXh0ID0gcHJldmlvdXNDb250ZXh0O1xuXHRcdGlmIChvcHRzIT09Rk9SQ0VfUkVOREVSXG5cdFx0XHQmJiBjb21wb25lbnQuc2hvdWxkQ29tcG9uZW50VXBkYXRlXG5cdFx0XHQmJiBjb21wb25lbnQuc2hvdWxkQ29tcG9uZW50VXBkYXRlKHByb3BzLCBzdGF0ZSwgY29udGV4dCkgPT09IGZhbHNlKSB7XG5cdFx0XHRza2lwID0gdHJ1ZTtcblx0XHR9XG5cdFx0ZWxzZSBpZiAoY29tcG9uZW50LmNvbXBvbmVudFdpbGxVcGRhdGUpIHtcblx0XHRcdGNvbXBvbmVudC5jb21wb25lbnRXaWxsVXBkYXRlKHByb3BzLCBzdGF0ZSwgY29udGV4dCk7XG5cdFx0fVxuXHRcdGNvbXBvbmVudC5wcm9wcyA9IHByb3BzO1xuXHRcdGNvbXBvbmVudC5zdGF0ZSA9IHN0YXRlO1xuXHRcdGNvbXBvbmVudC5jb250ZXh0ID0gY29udGV4dDtcblx0fVxuXG5cdGNvbXBvbmVudC5wcmV2UHJvcHMgPSBjb21wb25lbnQucHJldlN0YXRlID0gY29tcG9uZW50LnByZXZDb250ZXh0ID0gY29tcG9uZW50Lm5leHRCYXNlID0gbnVsbDtcblx0Y29tcG9uZW50Ll9kaXJ0eSA9IGZhbHNlO1xuXG5cdGlmICghc2tpcCkge1xuXHRcdHJlbmRlcmVkID0gY29tcG9uZW50LnJlbmRlcihwcm9wcywgc3RhdGUsIGNvbnRleHQpO1xuXG5cdFx0Ly8gY29udGV4dCB0byBwYXNzIHRvIHRoZSBjaGlsZCwgY2FuIGJlIHVwZGF0ZWQgdmlhIChncmFuZC0pcGFyZW50IGNvbXBvbmVudFxuXHRcdGlmIChjb21wb25lbnQuZ2V0Q2hpbGRDb250ZXh0KSB7XG5cdFx0XHRjb250ZXh0ID0gZXh0ZW5kKGV4dGVuZCh7fSwgY29udGV4dCksIGNvbXBvbmVudC5nZXRDaGlsZENvbnRleHQoKSk7XG5cdFx0fVxuXG5cdFx0bGV0IGNoaWxkQ29tcG9uZW50ID0gcmVuZGVyZWQgJiYgcmVuZGVyZWQubm9kZU5hbWUsXG5cdFx0XHR0b1VubW91bnQsIGJhc2U7XG5cblx0XHRpZiAodHlwZW9mIGNoaWxkQ29tcG9uZW50PT09J2Z1bmN0aW9uJykge1xuXHRcdFx0Ly8gc2V0IHVwIGhpZ2ggb3JkZXIgY29tcG9uZW50IGxpbmtcblxuXHRcdFx0bGV0IGNoaWxkUHJvcHMgPSBnZXROb2RlUHJvcHMocmVuZGVyZWQpO1xuXHRcdFx0aW5zdCA9IGluaXRpYWxDaGlsZENvbXBvbmVudDtcblxuXHRcdFx0aWYgKGluc3QgJiYgaW5zdC5jb25zdHJ1Y3Rvcj09PWNoaWxkQ29tcG9uZW50ICYmIGNoaWxkUHJvcHMua2V5PT1pbnN0Ll9fa2V5KSB7XG5cdFx0XHRcdHNldENvbXBvbmVudFByb3BzKGluc3QsIGNoaWxkUHJvcHMsIFNZTkNfUkVOREVSLCBjb250ZXh0LCBmYWxzZSk7XG5cdFx0XHR9XG5cdFx0XHRlbHNlIHtcblx0XHRcdFx0dG9Vbm1vdW50ID0gaW5zdDtcblxuXHRcdFx0XHRjb21wb25lbnQuX2NvbXBvbmVudCA9IGluc3QgPSBjcmVhdGVDb21wb25lbnQoY2hpbGRDb21wb25lbnQsIGNoaWxkUHJvcHMsIGNvbnRleHQpO1xuXHRcdFx0XHRpbnN0Lm5leHRCYXNlID0gaW5zdC5uZXh0QmFzZSB8fCBuZXh0QmFzZTtcblx0XHRcdFx0aW5zdC5fcGFyZW50Q29tcG9uZW50ID0gY29tcG9uZW50O1xuXHRcdFx0XHRzZXRDb21wb25lbnRQcm9wcyhpbnN0LCBjaGlsZFByb3BzLCBOT19SRU5ERVIsIGNvbnRleHQsIGZhbHNlKTtcblx0XHRcdFx0cmVuZGVyQ29tcG9uZW50KGluc3QsIFNZTkNfUkVOREVSLCBtb3VudEFsbCwgdHJ1ZSk7XG5cdFx0XHR9XG5cblx0XHRcdGJhc2UgPSBpbnN0LmJhc2U7XG5cdFx0fVxuXHRcdGVsc2Uge1xuXHRcdFx0Y2Jhc2UgPSBpbml0aWFsQmFzZTtcblxuXHRcdFx0Ly8gZGVzdHJveSBoaWdoIG9yZGVyIGNvbXBvbmVudCBsaW5rXG5cdFx0XHR0b1VubW91bnQgPSBpbml0aWFsQ2hpbGRDb21wb25lbnQ7XG5cdFx0XHRpZiAodG9Vbm1vdW50KSB7XG5cdFx0XHRcdGNiYXNlID0gY29tcG9uZW50Ll9jb21wb25lbnQgPSBudWxsO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAoaW5pdGlhbEJhc2UgfHwgb3B0cz09PVNZTkNfUkVOREVSKSB7XG5cdFx0XHRcdGlmIChjYmFzZSkgY2Jhc2UuX2NvbXBvbmVudCA9IG51bGw7XG5cdFx0XHRcdGJhc2UgPSBkaWZmKGNiYXNlLCByZW5kZXJlZCwgY29udGV4dCwgbW91bnRBbGwgfHwgIWlzVXBkYXRlLCBpbml0aWFsQmFzZSAmJiBpbml0aWFsQmFzZS5wYXJlbnROb2RlLCB0cnVlKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRpZiAoaW5pdGlhbEJhc2UgJiYgYmFzZSE9PWluaXRpYWxCYXNlICYmIGluc3QhPT1pbml0aWFsQ2hpbGRDb21wb25lbnQpIHtcblx0XHRcdGxldCBiYXNlUGFyZW50ID0gaW5pdGlhbEJhc2UucGFyZW50Tm9kZTtcblx0XHRcdGlmIChiYXNlUGFyZW50ICYmIGJhc2UhPT1iYXNlUGFyZW50KSB7XG5cdFx0XHRcdGJhc2VQYXJlbnQucmVwbGFjZUNoaWxkKGJhc2UsIGluaXRpYWxCYXNlKTtcblxuXHRcdFx0XHRpZiAoIXRvVW5tb3VudCkge1xuXHRcdFx0XHRcdGluaXRpYWxCYXNlLl9jb21wb25lbnQgPSBudWxsO1xuXHRcdFx0XHRcdHJlY29sbGVjdE5vZGVUcmVlKGluaXRpYWxCYXNlLCBmYWxzZSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cblx0XHRpZiAodG9Vbm1vdW50KSB7XG5cdFx0XHR1bm1vdW50Q29tcG9uZW50KHRvVW5tb3VudCk7XG5cdFx0fVxuXG5cdFx0Y29tcG9uZW50LmJhc2UgPSBiYXNlO1xuXHRcdGlmIChiYXNlICYmICFpc0NoaWxkKSB7XG5cdFx0XHRsZXQgY29tcG9uZW50UmVmID0gY29tcG9uZW50LFxuXHRcdFx0XHR0ID0gY29tcG9uZW50O1xuXHRcdFx0d2hpbGUgKCh0PXQuX3BhcmVudENvbXBvbmVudCkpIHtcblx0XHRcdFx0KGNvbXBvbmVudFJlZiA9IHQpLmJhc2UgPSBiYXNlO1xuXHRcdFx0fVxuXHRcdFx0YmFzZS5fY29tcG9uZW50ID0gY29tcG9uZW50UmVmO1xuXHRcdFx0YmFzZS5fY29tcG9uZW50Q29uc3RydWN0b3IgPSBjb21wb25lbnRSZWYuY29uc3RydWN0b3I7XG5cdFx0fVxuXHR9XG5cblx0aWYgKCFpc1VwZGF0ZSB8fCBtb3VudEFsbCkge1xuXHRcdG1vdW50cy51bnNoaWZ0KGNvbXBvbmVudCk7XG5cdH1cblx0ZWxzZSBpZiAoIXNraXApIHtcblx0XHQvLyBFbnN1cmUgdGhhdCBwZW5kaW5nIGNvbXBvbmVudERpZE1vdW50KCkgaG9va3Mgb2YgY2hpbGQgY29tcG9uZW50c1xuXHRcdC8vIGFyZSBjYWxsZWQgYmVmb3JlIHRoZSBjb21wb25lbnREaWRVcGRhdGUoKSBob29rIGluIHRoZSBwYXJlbnQuXG5cdFx0Zmx1c2hNb3VudHMoKTtcblxuXHRcdGlmIChjb21wb25lbnQuY29tcG9uZW50RGlkVXBkYXRlKSB7XG5cdFx0XHRjb21wb25lbnQuY29tcG9uZW50RGlkVXBkYXRlKHByZXZpb3VzUHJvcHMsIHByZXZpb3VzU3RhdGUsIHByZXZpb3VzQ29udGV4dCk7XG5cdFx0fVxuXHRcdGlmIChvcHRpb25zLmFmdGVyVXBkYXRlKSBvcHRpb25zLmFmdGVyVXBkYXRlKGNvbXBvbmVudCk7XG5cdH1cblxuXHRpZiAoY29tcG9uZW50Ll9yZW5kZXJDYWxsYmFja3MhPW51bGwpIHtcblx0XHR3aGlsZSAoY29tcG9uZW50Ll9yZW5kZXJDYWxsYmFja3MubGVuZ3RoKSBjb21wb25lbnQuX3JlbmRlckNhbGxiYWNrcy5wb3AoKS5jYWxsKGNvbXBvbmVudCk7XG5cdH1cblxuXHRpZiAoIWRpZmZMZXZlbCAmJiAhaXNDaGlsZCkgZmx1c2hNb3VudHMoKTtcbn1cblxuXG5cbi8qKiBBcHBseSB0aGUgQ29tcG9uZW50IHJlZmVyZW5jZWQgYnkgYSBWTm9kZSB0byB0aGUgRE9NLlxuICpcdEBwYXJhbSB7RWxlbWVudH0gZG9tXHRUaGUgRE9NIG5vZGUgdG8gbXV0YXRlXG4gKlx0QHBhcmFtIHtWTm9kZX0gdm5vZGVcdEEgQ29tcG9uZW50LXJlZmVyZW5jaW5nIFZOb2RlXG4gKlx0QHJldHVybnMge0VsZW1lbnR9IGRvbVx0VGhlIGNyZWF0ZWQvbXV0YXRlZCBlbGVtZW50XG4gKlx0QHByaXZhdGVcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGJ1aWxkQ29tcG9uZW50RnJvbVZOb2RlKGRvbSwgdm5vZGUsIGNvbnRleHQsIG1vdW50QWxsKSB7XG5cdGxldCBjID0gZG9tICYmIGRvbS5fY29tcG9uZW50LFxuXHRcdG9yaWdpbmFsQ29tcG9uZW50ID0gYyxcblx0XHRvbGREb20gPSBkb20sXG5cdFx0aXNEaXJlY3RPd25lciA9IGMgJiYgZG9tLl9jb21wb25lbnRDb25zdHJ1Y3Rvcj09PXZub2RlLm5vZGVOYW1lLFxuXHRcdGlzT3duZXIgPSBpc0RpcmVjdE93bmVyLFxuXHRcdHByb3BzID0gZ2V0Tm9kZVByb3BzKHZub2RlKTtcblx0d2hpbGUgKGMgJiYgIWlzT3duZXIgJiYgKGM9Yy5fcGFyZW50Q29tcG9uZW50KSkge1xuXHRcdGlzT3duZXIgPSBjLmNvbnN0cnVjdG9yPT09dm5vZGUubm9kZU5hbWU7XG5cdH1cblxuXHRpZiAoYyAmJiBpc093bmVyICYmICghbW91bnRBbGwgfHwgYy5fY29tcG9uZW50KSkge1xuXHRcdHNldENvbXBvbmVudFByb3BzKGMsIHByb3BzLCBBU1lOQ19SRU5ERVIsIGNvbnRleHQsIG1vdW50QWxsKTtcblx0XHRkb20gPSBjLmJhc2U7XG5cdH1cblx0ZWxzZSB7XG5cdFx0aWYgKG9yaWdpbmFsQ29tcG9uZW50ICYmICFpc0RpcmVjdE93bmVyKSB7XG5cdFx0XHR1bm1vdW50Q29tcG9uZW50KG9yaWdpbmFsQ29tcG9uZW50KTtcblx0XHRcdGRvbSA9IG9sZERvbSA9IG51bGw7XG5cdFx0fVxuXG5cdFx0YyA9IGNyZWF0ZUNvbXBvbmVudCh2bm9kZS5ub2RlTmFtZSwgcHJvcHMsIGNvbnRleHQpO1xuXHRcdGlmIChkb20gJiYgIWMubmV4dEJhc2UpIHtcblx0XHRcdGMubmV4dEJhc2UgPSBkb207XG5cdFx0XHQvLyBwYXNzaW5nIGRvbS9vbGREb20gYXMgbmV4dEJhc2Ugd2lsbCByZWN5Y2xlIGl0IGlmIHVudXNlZCwgc28gYnlwYXNzIHJlY3ljbGluZyBvbiBMMjI5OlxuXHRcdFx0b2xkRG9tID0gbnVsbDtcblx0XHR9XG5cdFx0c2V0Q29tcG9uZW50UHJvcHMoYywgcHJvcHMsIFNZTkNfUkVOREVSLCBjb250ZXh0LCBtb3VudEFsbCk7XG5cdFx0ZG9tID0gYy5iYXNlO1xuXG5cdFx0aWYgKG9sZERvbSAmJiBkb20hPT1vbGREb20pIHtcblx0XHRcdG9sZERvbS5fY29tcG9uZW50ID0gbnVsbDtcblx0XHRcdHJlY29sbGVjdE5vZGVUcmVlKG9sZERvbSwgZmFsc2UpO1xuXHRcdH1cblx0fVxuXG5cdHJldHVybiBkb207XG59XG5cblxuXG4vKiogUmVtb3ZlIGEgY29tcG9uZW50IGZyb20gdGhlIERPTSBhbmQgcmVjeWNsZSBpdC5cbiAqXHRAcGFyYW0ge0NvbXBvbmVudH0gY29tcG9uZW50XHRUaGUgQ29tcG9uZW50IGluc3RhbmNlIHRvIHVubW91bnRcbiAqXHRAcHJpdmF0ZVxuICovXG5leHBvcnQgZnVuY3Rpb24gdW5tb3VudENvbXBvbmVudChjb21wb25lbnQpIHtcblx0aWYgKG9wdGlvbnMuYmVmb3JlVW5tb3VudCkgb3B0aW9ucy5iZWZvcmVVbm1vdW50KGNvbXBvbmVudCk7XG5cblx0bGV0IGJhc2UgPSBjb21wb25lbnQuYmFzZTtcblxuXHRjb21wb25lbnQuX2Rpc2FibGUgPSB0cnVlO1xuXG5cdGlmIChjb21wb25lbnQuY29tcG9uZW50V2lsbFVubW91bnQpIGNvbXBvbmVudC5jb21wb25lbnRXaWxsVW5tb3VudCgpO1xuXG5cdGNvbXBvbmVudC5iYXNlID0gbnVsbDtcblxuXHQvLyByZWN1cnNpdmVseSB0ZWFyIGRvd24gJiByZWNvbGxlY3QgaGlnaC1vcmRlciBjb21wb25lbnQgY2hpbGRyZW46XG5cdGxldCBpbm5lciA9IGNvbXBvbmVudC5fY29tcG9uZW50O1xuXHRpZiAoaW5uZXIpIHtcblx0XHR1bm1vdW50Q29tcG9uZW50KGlubmVyKTtcblx0fVxuXHRlbHNlIGlmIChiYXNlKSB7XG5cdFx0aWYgKGJhc2VbQVRUUl9LRVldICYmIGJhc2VbQVRUUl9LRVldLnJlZikgYmFzZVtBVFRSX0tFWV0ucmVmKG51bGwpO1xuXG5cdFx0Y29tcG9uZW50Lm5leHRCYXNlID0gYmFzZTtcblxuXHRcdHJlbW92ZU5vZGUoYmFzZSk7XG5cdFx0Y29sbGVjdENvbXBvbmVudChjb21wb25lbnQpO1xuXG5cdFx0cmVtb3ZlQ2hpbGRyZW4oYmFzZSk7XG5cdH1cblxuXHRpZiAoY29tcG9uZW50Ll9fcmVmKSBjb21wb25lbnQuX19yZWYobnVsbCk7XG59XG4iLCJpbXBvcnQgeyBGT1JDRV9SRU5ERVIgfSBmcm9tICcuL2NvbnN0YW50cyc7XG5pbXBvcnQgeyBleHRlbmQgfSBmcm9tICcuL3V0aWwnO1xuaW1wb3J0IHsgcmVuZGVyQ29tcG9uZW50IH0gZnJvbSAnLi92ZG9tL2NvbXBvbmVudCc7XG5pbXBvcnQgeyBlbnF1ZXVlUmVuZGVyIH0gZnJvbSAnLi9yZW5kZXItcXVldWUnO1xuXG4vKiogQmFzZSBDb21wb25lbnQgY2xhc3MuXG4gKlx0UHJvdmlkZXMgYHNldFN0YXRlKClgIGFuZCBgZm9yY2VVcGRhdGUoKWAsIHdoaWNoIHRyaWdnZXIgcmVuZGVyaW5nLlxuICpcdEBwdWJsaWNcbiAqXG4gKlx0QGV4YW1wbGVcbiAqXHRjbGFzcyBNeUZvbyBleHRlbmRzIENvbXBvbmVudCB7XG4gKlx0XHRyZW5kZXIocHJvcHMsIHN0YXRlKSB7XG4gKlx0XHRcdHJldHVybiA8ZGl2IC8+O1xuICpcdFx0fVxuICpcdH1cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIENvbXBvbmVudChwcm9wcywgY29udGV4dCkge1xuXHR0aGlzLl9kaXJ0eSA9IHRydWU7XG5cblx0LyoqIEBwdWJsaWNcblx0ICpcdEB0eXBlIHtvYmplY3R9XG5cdCAqL1xuXHR0aGlzLmNvbnRleHQgPSBjb250ZXh0O1xuXG5cdC8qKiBAcHVibGljXG5cdCAqXHRAdHlwZSB7b2JqZWN0fVxuXHQgKi9cblx0dGhpcy5wcm9wcyA9IHByb3BzO1xuXG5cdC8qKiBAcHVibGljXG5cdCAqXHRAdHlwZSB7b2JqZWN0fVxuXHQgKi9cblx0dGhpcy5zdGF0ZSA9IHRoaXMuc3RhdGUgfHwge307XG59XG5cblxuZXh0ZW5kKENvbXBvbmVudC5wcm90b3R5cGUsIHtcblxuXHQvKiogUmV0dXJucyBhIGBib29sZWFuYCBpbmRpY2F0aW5nIGlmIHRoZSBjb21wb25lbnQgc2hvdWxkIHJlLXJlbmRlciB3aGVuIHJlY2VpdmluZyB0aGUgZ2l2ZW4gYHByb3BzYCBhbmQgYHN0YXRlYC5cblx0ICpcdEBwYXJhbSB7b2JqZWN0fSBuZXh0UHJvcHNcblx0ICpcdEBwYXJhbSB7b2JqZWN0fSBuZXh0U3RhdGVcblx0ICpcdEBwYXJhbSB7b2JqZWN0fSBuZXh0Q29udGV4dFxuXHQgKlx0QHJldHVybnMge0Jvb2xlYW59IHNob3VsZCB0aGUgY29tcG9uZW50IHJlLXJlbmRlclxuXHQgKlx0QG5hbWUgc2hvdWxkQ29tcG9uZW50VXBkYXRlXG5cdCAqXHRAZnVuY3Rpb25cblx0ICovXG5cblxuXHQvKiogVXBkYXRlIGNvbXBvbmVudCBzdGF0ZSBieSBjb3B5aW5nIHByb3BlcnRpZXMgZnJvbSBgc3RhdGVgIHRvIGB0aGlzLnN0YXRlYC5cblx0ICpcdEBwYXJhbSB7b2JqZWN0fSBzdGF0ZVx0XHRBIGhhc2ggb2Ygc3RhdGUgcHJvcGVydGllcyB0byB1cGRhdGUgd2l0aCBuZXcgdmFsdWVzXG5cdCAqXHRAcGFyYW0ge2Z1bmN0aW9ufSBjYWxsYmFja1x0QSBmdW5jdGlvbiB0byBiZSBjYWxsZWQgb25jZSBjb21wb25lbnQgc3RhdGUgaXMgdXBkYXRlZFxuXHQgKi9cblx0c2V0U3RhdGUoc3RhdGUsIGNhbGxiYWNrKSB7XG5cdFx0bGV0IHMgPSB0aGlzLnN0YXRlO1xuXHRcdGlmICghdGhpcy5wcmV2U3RhdGUpIHRoaXMucHJldlN0YXRlID0gZXh0ZW5kKHt9LCBzKTtcblx0XHRleHRlbmQocywgdHlwZW9mIHN0YXRlPT09J2Z1bmN0aW9uJyA/IHN0YXRlKHMsIHRoaXMucHJvcHMpIDogc3RhdGUpO1xuXHRcdGlmIChjYWxsYmFjaykgKHRoaXMuX3JlbmRlckNhbGxiYWNrcyA9ICh0aGlzLl9yZW5kZXJDYWxsYmFja3MgfHwgW10pKS5wdXNoKGNhbGxiYWNrKTtcblx0XHRlbnF1ZXVlUmVuZGVyKHRoaXMpO1xuXHR9LFxuXG5cblx0LyoqIEltbWVkaWF0ZWx5IHBlcmZvcm0gYSBzeW5jaHJvbm91cyByZS1yZW5kZXIgb2YgdGhlIGNvbXBvbmVudC5cblx0ICpcdEBwYXJhbSB7ZnVuY3Rpb259IGNhbGxiYWNrXHRcdEEgZnVuY3Rpb24gdG8gYmUgY2FsbGVkIGFmdGVyIGNvbXBvbmVudCBpcyByZS1yZW5kZXJlZC5cblx0ICpcdEBwcml2YXRlXG5cdCAqL1xuXHRmb3JjZVVwZGF0ZShjYWxsYmFjaykge1xuXHRcdGlmIChjYWxsYmFjaykgKHRoaXMuX3JlbmRlckNhbGxiYWNrcyA9ICh0aGlzLl9yZW5kZXJDYWxsYmFja3MgfHwgW10pKS5wdXNoKGNhbGxiYWNrKTtcblx0XHRyZW5kZXJDb21wb25lbnQodGhpcywgRk9SQ0VfUkVOREVSKTtcblx0fSxcblxuXG5cdC8qKiBBY2NlcHRzIGBwcm9wc2AgYW5kIGBzdGF0ZWAsIGFuZCByZXR1cm5zIGEgbmV3IFZpcnR1YWwgRE9NIHRyZWUgdG8gYnVpbGQuXG5cdCAqXHRWaXJ0dWFsIERPTSBpcyBnZW5lcmFsbHkgY29uc3RydWN0ZWQgdmlhIFtKU1hdKGh0dHA6Ly9qYXNvbmZvcm1hdC5jb20vd3RmLWlzLWpzeCkuXG5cdCAqXHRAcGFyYW0ge29iamVjdH0gcHJvcHNcdFx0UHJvcHMgKGVnOiBKU1ggYXR0cmlidXRlcykgcmVjZWl2ZWQgZnJvbSBwYXJlbnQgZWxlbWVudC9jb21wb25lbnRcblx0ICpcdEBwYXJhbSB7b2JqZWN0fSBzdGF0ZVx0XHRUaGUgY29tcG9uZW50J3MgY3VycmVudCBzdGF0ZVxuXHQgKlx0QHBhcmFtIHtvYmplY3R9IGNvbnRleHRcdFx0Q29udGV4dCBvYmplY3QgKGlmIGEgcGFyZW50IGNvbXBvbmVudCBoYXMgcHJvdmlkZWQgY29udGV4dClcblx0ICpcdEByZXR1cm5zIFZOb2RlXG5cdCAqL1xuXHRyZW5kZXIoKSB7fVxuXG59KTtcbiIsImltcG9ydCB7IGRpZmYgfSBmcm9tICcuL3Zkb20vZGlmZic7XG5cbi8qKiBSZW5kZXIgSlNYIGludG8gYSBgcGFyZW50YCBFbGVtZW50LlxuICpcdEBwYXJhbSB7Vk5vZGV9IHZub2RlXHRcdEEgKEpTWCkgVk5vZGUgdG8gcmVuZGVyXG4gKlx0QHBhcmFtIHtFbGVtZW50fSBwYXJlbnRcdFx0RE9NIGVsZW1lbnQgdG8gcmVuZGVyIGludG9cbiAqXHRAcGFyYW0ge0VsZW1lbnR9IFttZXJnZV1cdEF0dGVtcHQgdG8gcmUtdXNlIGFuIGV4aXN0aW5nIERPTSB0cmVlIHJvb3RlZCBhdCBgbWVyZ2VgXG4gKlx0QHB1YmxpY1xuICpcbiAqXHRAZXhhbXBsZVxuICpcdC8vIHJlbmRlciBhIGRpdiBpbnRvIDxib2R5PjpcbiAqXHRyZW5kZXIoPGRpdiBpZD1cImhlbGxvXCI+aGVsbG8hPC9kaXY+LCBkb2N1bWVudC5ib2R5KTtcbiAqXG4gKlx0QGV4YW1wbGVcbiAqXHQvLyByZW5kZXIgYSBcIlRoaW5nXCIgY29tcG9uZW50IGludG8gI2ZvbzpcbiAqXHRjb25zdCBUaGluZyA9ICh7IG5hbWUgfSkgPT4gPHNwYW4+eyBuYW1lIH08L3NwYW4+O1xuICpcdHJlbmRlcig8VGhpbmcgbmFtZT1cIm9uZVwiIC8+LCBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcjZm9vJykpO1xuICovXG5leHBvcnQgZnVuY3Rpb24gcmVuZGVyKHZub2RlLCBwYXJlbnQsIG1lcmdlKSB7XG5cdHJldHVybiBkaWZmKG1lcmdlLCB2bm9kZSwge30sIGZhbHNlLCBwYXJlbnQsIGZhbHNlKTtcbn1cbiIsImxldCBhciA9IDQgLyAzXG5cbmZ1bmN0aW9uIHJlc2l6ZSAoKSB7XG4gICAgY29uc3RcbiAgICAgICAgaHRtbCA9IGRvY3VtZW50LmRvY3VtZW50RWxlbWVudCxcbiAgICAgICAgdyA9IGh0bWwuY2xpZW50V2lkdGgsXG4gICAgICAgIGggPSBodG1sLmNsaWVudEhlaWdodCxcbiAgICAgICAgbGFuZHNjYXBlID0gdyAvIGggPiBhcixcbiAgICAgICAgd2lkdGggPSBsYW5kc2NhcGUgPyBNYXRoLmZsb29yKGggKiBhcikgOiB3LFxuICAgICAgICBoZWlnaHQgPSBsYW5kc2NhcGUgPyBoIDogTWF0aC5mbG9vcih3IC8gYXIpXG4gICAgaWYgKHcpIHtcbiAgICAgICAgaHRtbC5zdHlsZS5mb250U2l6ZSA9IGhlaWdodCAvIDEwMCArICdweCdcbiAgICAgICAgaHRtbC5zdHlsZS5kaXNwbGF5ID0gXCJub25lXCJcbiAgICAgICAgLy8gICAgICAgICAgICBodG1sLmNsaWVudFdpZHRoOyAvLyBGb3JjZSByZWxheW91dCAtIGltcG9ydGFudCB0byBuZXcgQW5kcm9pZCBkZXZpY2VzXG4gICAgICAgIGh0bWwuc3R5bGUuZGlzcGxheSA9IFwiXCJcbiAgICB9XG4gICAgZG9jdW1lbnQuYm9keS5zdHlsZS5jc3NUZXh0ID0gYG1hcmdpbi10b3A6ICR7LWhlaWdodCAvIDJ9cHg7IG1hcmdpbi1sZWZ0OiAkey13aWR0aCAvIDJ9cHg7IHdpZHRoOiAke3dpZHRofXB4OyBoZWlnaHQ6ICR7aGVpZ2h0fXB4O2Bcbn1cblxud2luZG93LmFkZEV2ZW50TGlzdGVuZXIoJ3Jlc2l6ZScsIHJlc2l6ZSlcbnJlc2l6ZSgpXG5cbmV4cG9ydCBmdW5jdGlvbiBzZXRBciAodmFsdWUpIHtcbiAgICBpZiAoYXIgIT09IHZhbHVlKSB7XG4gICAgICAgIGFyID0gdmFsdWVcbiAgICAgICAgcmVzaXplKClcbiAgICB9XG59XG4iLCIvKiogVmlydHVhbCBET00gTm9kZSAqL1xuZXhwb3J0IGZ1bmN0aW9uIFZOb2RlKCkge31cbiIsIi8qKiBHbG9iYWwgb3B0aW9uc1xuICpcdEBwdWJsaWNcbiAqXHRAbmFtZXNwYWNlIG9wdGlvbnMge09iamVjdH1cbiAqL1xuZXhwb3J0IGRlZmF1bHQge1xuXG5cdC8qKiBJZiBgdHJ1ZWAsIGBwcm9wYCBjaGFuZ2VzIHRyaWdnZXIgc3luY2hyb25vdXMgY29tcG9uZW50IHVwZGF0ZXMuXG5cdCAqXHRAbmFtZSBzeW5jQ29tcG9uZW50VXBkYXRlc1xuXHQgKlx0QHR5cGUgQm9vbGVhblxuXHQgKlx0QGRlZmF1bHQgdHJ1ZVxuXHQgKi9cblx0Ly9zeW5jQ29tcG9uZW50VXBkYXRlczogdHJ1ZSxcblxuXHQvKiogUHJvY2Vzc2VzIGFsbCBjcmVhdGVkIFZOb2Rlcy5cblx0ICpcdEBwYXJhbSB7Vk5vZGV9IHZub2RlXHRBIG5ld2x5LWNyZWF0ZWQgVk5vZGUgdG8gbm9ybWFsaXplL3Byb2Nlc3Ncblx0ICovXG5cdC8vdm5vZGUodm5vZGUpIHsgfVxuXG5cdC8qKiBIb29rIGludm9rZWQgYWZ0ZXIgYSBjb21wb25lbnQgaXMgbW91bnRlZC4gKi9cblx0Ly8gYWZ0ZXJNb3VudChjb21wb25lbnQpIHsgfVxuXG5cdC8qKiBIb29rIGludm9rZWQgYWZ0ZXIgdGhlIERPTSBpcyB1cGRhdGVkIHdpdGggYSBjb21wb25lbnQncyBsYXRlc3QgcmVuZGVyLiAqL1xuXHQvLyBhZnRlclVwZGF0ZShjb21wb25lbnQpIHsgfVxuXG5cdC8qKiBIb29rIGludm9rZWQgaW1tZWRpYXRlbHkgYmVmb3JlIGEgY29tcG9uZW50IGlzIHVubW91bnRlZC4gKi9cblx0Ly8gYmVmb3JlVW5tb3VudChjb21wb25lbnQpIHsgfVxufTtcbiIsImltcG9ydCB7IFZOb2RlIH0gZnJvbSAnLi92bm9kZSc7XG5pbXBvcnQgb3B0aW9ucyBmcm9tICcuL29wdGlvbnMnO1xuXG5cbmNvbnN0IHN0YWNrID0gW107XG5cbmNvbnN0IEVNUFRZX0NISUxEUkVOID0gW107XG5cbi8qKiBKU1gvaHlwZXJzY3JpcHQgcmV2aXZlclxuKlx0QmVuY2htYXJrczogaHR0cHM6Ly9lc2JlbmNoLmNvbS9iZW5jaC81N2VlOGY4ZTMzMGFiMDk5MDBhMWExYTBcbiAqXHRAc2VlIGh0dHA6Ly9qYXNvbmZvcm1hdC5jb20vd3RmLWlzLWpzeFxuICpcdEBwdWJsaWNcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGgobm9kZU5hbWUsIGF0dHJpYnV0ZXMpIHtcblx0bGV0IGNoaWxkcmVuPUVNUFRZX0NISUxEUkVOLCBsYXN0U2ltcGxlLCBjaGlsZCwgc2ltcGxlLCBpO1xuXHRmb3IgKGk9YXJndW1lbnRzLmxlbmd0aDsgaS0tID4gMjsgKSB7XG5cdFx0c3RhY2sucHVzaChhcmd1bWVudHNbaV0pO1xuXHR9XG5cdGlmIChhdHRyaWJ1dGVzICYmIGF0dHJpYnV0ZXMuY2hpbGRyZW4hPW51bGwpIHtcblx0XHRpZiAoIXN0YWNrLmxlbmd0aCkgc3RhY2sucHVzaChhdHRyaWJ1dGVzLmNoaWxkcmVuKTtcblx0XHRkZWxldGUgYXR0cmlidXRlcy5jaGlsZHJlbjtcblx0fVxuXHR3aGlsZSAoc3RhY2subGVuZ3RoKSB7XG5cdFx0aWYgKChjaGlsZCA9IHN0YWNrLnBvcCgpKSAmJiBjaGlsZC5wb3AhPT11bmRlZmluZWQpIHtcblx0XHRcdGZvciAoaT1jaGlsZC5sZW5ndGg7IGktLTsgKSBzdGFjay5wdXNoKGNoaWxkW2ldKTtcblx0XHR9XG5cdFx0ZWxzZSB7XG5cdFx0XHRpZiAoY2hpbGQ9PT10cnVlIHx8IGNoaWxkPT09ZmFsc2UpIGNoaWxkID0gbnVsbDtcblxuXHRcdFx0aWYgKChzaW1wbGUgPSB0eXBlb2Ygbm9kZU5hbWUhPT0nZnVuY3Rpb24nKSkge1xuXHRcdFx0XHRpZiAoY2hpbGQ9PW51bGwpIGNoaWxkID0gJyc7XG5cdFx0XHRcdGVsc2UgaWYgKHR5cGVvZiBjaGlsZD09PSdudW1iZXInKSBjaGlsZCA9IFN0cmluZyhjaGlsZCk7XG5cdFx0XHRcdGVsc2UgaWYgKHR5cGVvZiBjaGlsZCE9PSdzdHJpbmcnKSBzaW1wbGUgPSBmYWxzZTtcblx0XHRcdH1cblxuXHRcdFx0aWYgKHNpbXBsZSAmJiBsYXN0U2ltcGxlKSB7XG5cdFx0XHRcdGNoaWxkcmVuW2NoaWxkcmVuLmxlbmd0aC0xXSArPSBjaGlsZDtcblx0XHRcdH1cblx0XHRcdGVsc2UgaWYgKGNoaWxkcmVuPT09RU1QVFlfQ0hJTERSRU4pIHtcblx0XHRcdFx0Y2hpbGRyZW4gPSBbY2hpbGRdO1xuXHRcdFx0fVxuXHRcdFx0ZWxzZSB7XG5cdFx0XHRcdGNoaWxkcmVuLnB1c2goY2hpbGQpO1xuXHRcdFx0fVxuXG5cdFx0XHRsYXN0U2ltcGxlID0gc2ltcGxlO1xuXHRcdH1cblx0fVxuXG5cdGxldCBwID0gbmV3IFZOb2RlKCk7XG5cdHAubm9kZU5hbWUgPSBub2RlTmFtZTtcblx0cC5jaGlsZHJlbiA9IGNoaWxkcmVuO1xuXHRwLmF0dHJpYnV0ZXMgPSBhdHRyaWJ1dGVzPT1udWxsID8gdW5kZWZpbmVkIDogYXR0cmlidXRlcztcblx0cC5rZXkgPSBhdHRyaWJ1dGVzPT1udWxsID8gdW5kZWZpbmVkIDogYXR0cmlidXRlcy5rZXk7XG5cblx0Ly8gaWYgYSBcInZub2RlIGhvb2tcIiBpcyBkZWZpbmVkLCBwYXNzIGV2ZXJ5IGNyZWF0ZWQgVk5vZGUgdG8gaXRcblx0aWYgKG9wdGlvbnMudm5vZGUhPT11bmRlZmluZWQpIG9wdGlvbnMudm5vZGUocCk7XG5cblx0cmV0dXJuIHA7XG59XG4iLCIvKiogQ29weSBvd24tcHJvcGVydGllcyBmcm9tIGBwcm9wc2Agb250byBgb2JqYC5cbiAqXHRAcmV0dXJucyBvYmpcbiAqXHRAcHJpdmF0ZVxuICovXG5leHBvcnQgZnVuY3Rpb24gZXh0ZW5kKG9iaiwgcHJvcHMpIHtcblx0Zm9yIChsZXQgaSBpbiBwcm9wcykgb2JqW2ldID0gcHJvcHNbaV07XG5cdHJldHVybiBvYmo7XG59XG5cblxuIiwiLy8gcmVuZGVyIG1vZGVzXG5cbmV4cG9ydCBjb25zdCBOT19SRU5ERVIgPSAwO1xuZXhwb3J0IGNvbnN0IFNZTkNfUkVOREVSID0gMTtcbmV4cG9ydCBjb25zdCBGT1JDRV9SRU5ERVIgPSAyO1xuZXhwb3J0IGNvbnN0IEFTWU5DX1JFTkRFUiA9IDM7XG5cblxuZXhwb3J0IGNvbnN0IEFUVFJfS0VZID0gJ19fcHJlYWN0YXR0cl8nO1xuXG4vLyBET00gcHJvcGVydGllcyB0aGF0IHNob3VsZCBOT1QgaGF2ZSBcInB4XCIgYWRkZWQgd2hlbiBudW1lcmljXG5leHBvcnQgY29uc3QgSVNfTk9OX0RJTUVOU0lPTkFMID0gL2FjaXR8ZXgoPzpzfGd8bnxwfCQpfHJwaHxvd3N8bW5jfG50d3xpbmVbY2hdfHpvb3xeb3JkL2k7XG5cbiIsImltcG9ydCBvcHRpb25zIGZyb20gJy4vb3B0aW9ucyc7XG5pbXBvcnQgeyByZW5kZXJDb21wb25lbnQgfSBmcm9tICcuL3Zkb20vY29tcG9uZW50JztcblxuLyoqIE1hbmFnZWQgcXVldWUgb2YgZGlydHkgY29tcG9uZW50cyB0byBiZSByZS1yZW5kZXJlZCAqL1xuXG5sZXQgaXRlbXMgPSBbXTtcblxuZXhwb3J0IGZ1bmN0aW9uIGVucXVldWVSZW5kZXIoY29tcG9uZW50KSB7XG5cdGlmICghY29tcG9uZW50Ll9kaXJ0eSAmJiAoY29tcG9uZW50Ll9kaXJ0eSA9IHRydWUpICYmIGl0ZW1zLnB1c2goY29tcG9uZW50KT09MSkge1xuXHRcdChvcHRpb25zLmRlYm91bmNlUmVuZGVyaW5nIHx8IHNldFRpbWVvdXQpKHJlcmVuZGVyKTtcblx0fVxufVxuXG5cbmV4cG9ydCBmdW5jdGlvbiByZXJlbmRlcigpIHtcblx0bGV0IHAsIGxpc3QgPSBpdGVtcztcblx0aXRlbXMgPSBbXTtcblx0d2hpbGUgKCAocCA9IGxpc3QucG9wKCkpICkge1xuXHRcdGlmIChwLl9kaXJ0eSkgcmVuZGVyQ29tcG9uZW50KHApO1xuXHR9XG59XG4iLCJpbXBvcnQgeyBleHRlbmQgfSBmcm9tICcuLi91dGlsJztcblxuXG4vKiogQ2hlY2sgaWYgdHdvIG5vZGVzIGFyZSBlcXVpdmFsZW50LlxuICpcdEBwYXJhbSB7RWxlbWVudH0gbm9kZVxuICpcdEBwYXJhbSB7Vk5vZGV9IHZub2RlXG4gKlx0QHByaXZhdGVcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGlzU2FtZU5vZGVUeXBlKG5vZGUsIHZub2RlLCBoeWRyYXRpbmcpIHtcblx0aWYgKHR5cGVvZiB2bm9kZT09PSdzdHJpbmcnIHx8IHR5cGVvZiB2bm9kZT09PSdudW1iZXInKSB7XG5cdFx0cmV0dXJuIG5vZGUuc3BsaXRUZXh0IT09dW5kZWZpbmVkO1xuXHR9XG5cdGlmICh0eXBlb2Ygdm5vZGUubm9kZU5hbWU9PT0nc3RyaW5nJykge1xuXHRcdHJldHVybiAhbm9kZS5fY29tcG9uZW50Q29uc3RydWN0b3IgJiYgaXNOYW1lZE5vZGUobm9kZSwgdm5vZGUubm9kZU5hbWUpO1xuXHR9XG5cdHJldHVybiBoeWRyYXRpbmcgfHwgbm9kZS5fY29tcG9uZW50Q29uc3RydWN0b3I9PT12bm9kZS5ub2RlTmFtZTtcbn1cblxuXG4vKiogQ2hlY2sgaWYgYW4gRWxlbWVudCBoYXMgYSBnaXZlbiBub3JtYWxpemVkIG5hbWUuXG4qXHRAcGFyYW0ge0VsZW1lbnR9IG5vZGVcbipcdEBwYXJhbSB7U3RyaW5nfSBub2RlTmFtZVxuICovXG5leHBvcnQgZnVuY3Rpb24gaXNOYW1lZE5vZGUobm9kZSwgbm9kZU5hbWUpIHtcblx0cmV0dXJuIG5vZGUubm9ybWFsaXplZE5vZGVOYW1lPT09bm9kZU5hbWUgfHwgbm9kZS5ub2RlTmFtZS50b0xvd2VyQ2FzZSgpPT09bm9kZU5hbWUudG9Mb3dlckNhc2UoKTtcbn1cblxuXG4vKipcbiAqIFJlY29uc3RydWN0IENvbXBvbmVudC1zdHlsZSBgcHJvcHNgIGZyb20gYSBWTm9kZS5cbiAqIEVuc3VyZXMgZGVmYXVsdC9mYWxsYmFjayB2YWx1ZXMgZnJvbSBgZGVmYXVsdFByb3BzYDpcbiAqIE93bi1wcm9wZXJ0aWVzIG9mIGBkZWZhdWx0UHJvcHNgIG5vdCBwcmVzZW50IGluIGB2bm9kZS5hdHRyaWJ1dGVzYCBhcmUgYWRkZWQuXG4gKiBAcGFyYW0ge1ZOb2RlfSB2bm9kZVxuICogQHJldHVybnMge09iamVjdH0gcHJvcHNcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGdldE5vZGVQcm9wcyh2bm9kZSkge1xuXHRsZXQgcHJvcHMgPSBleHRlbmQoe30sIHZub2RlLmF0dHJpYnV0ZXMpO1xuXHRwcm9wcy5jaGlsZHJlbiA9IHZub2RlLmNoaWxkcmVuO1xuXG5cdGxldCBkZWZhdWx0UHJvcHMgPSB2bm9kZS5ub2RlTmFtZS5kZWZhdWx0UHJvcHM7XG5cdGlmIChkZWZhdWx0UHJvcHMhPT11bmRlZmluZWQpIHtcblx0XHRmb3IgKGxldCBpIGluIGRlZmF1bHRQcm9wcykge1xuXHRcdFx0aWYgKHByb3BzW2ldPT09dW5kZWZpbmVkKSB7XG5cdFx0XHRcdHByb3BzW2ldID0gZGVmYXVsdFByb3BzW2ldO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdHJldHVybiBwcm9wcztcbn1cbiIsImltcG9ydCB7IElTX05PTl9ESU1FTlNJT05BTCB9IGZyb20gJy4uL2NvbnN0YW50cyc7XG5pbXBvcnQgb3B0aW9ucyBmcm9tICcuLi9vcHRpb25zJztcblxuXG4vKiogQ3JlYXRlIGFuIGVsZW1lbnQgd2l0aCB0aGUgZ2l2ZW4gbm9kZU5hbWUuXG4gKlx0QHBhcmFtIHtTdHJpbmd9IG5vZGVOYW1lXG4gKlx0QHBhcmFtIHtCb29sZWFufSBbaXNTdmc9ZmFsc2VdXHRJZiBgdHJ1ZWAsIGNyZWF0ZXMgYW4gZWxlbWVudCB3aXRoaW4gdGhlIFNWRyBuYW1lc3BhY2UuXG4gKlx0QHJldHVybnMge0VsZW1lbnR9IG5vZGVcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZU5vZGUobm9kZU5hbWUsIGlzU3ZnKSB7XG5cdGxldCBub2RlID0gaXNTdmcgPyBkb2N1bWVudC5jcmVhdGVFbGVtZW50TlMoJ2h0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnJywgbm9kZU5hbWUpIDogZG9jdW1lbnQuY3JlYXRlRWxlbWVudChub2RlTmFtZSk7XG5cdG5vZGUubm9ybWFsaXplZE5vZGVOYW1lID0gbm9kZU5hbWU7XG5cdHJldHVybiBub2RlO1xufVxuXG5cbi8qKiBSZW1vdmUgYSBjaGlsZCBub2RlIGZyb20gaXRzIHBhcmVudCBpZiBhdHRhY2hlZC5cbiAqXHRAcGFyYW0ge0VsZW1lbnR9IG5vZGVcdFx0VGhlIG5vZGUgdG8gcmVtb3ZlXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiByZW1vdmVOb2RlKG5vZGUpIHtcblx0aWYgKG5vZGUucGFyZW50Tm9kZSkgbm9kZS5wYXJlbnROb2RlLnJlbW92ZUNoaWxkKG5vZGUpO1xufVxuXG5cbi8qKiBTZXQgYSBuYW1lZCBhdHRyaWJ1dGUgb24gdGhlIGdpdmVuIE5vZGUsIHdpdGggc3BlY2lhbCBiZWhhdmlvciBmb3Igc29tZSBuYW1lcyBhbmQgZXZlbnQgaGFuZGxlcnMuXG4gKlx0SWYgYHZhbHVlYCBpcyBgbnVsbGAsIHRoZSBhdHRyaWJ1dGUvaGFuZGxlciB3aWxsIGJlIHJlbW92ZWQuXG4gKlx0QHBhcmFtIHtFbGVtZW50fSBub2RlXHRBbiBlbGVtZW50IHRvIG11dGF0ZVxuICpcdEBwYXJhbSB7c3RyaW5nfSBuYW1lXHRUaGUgbmFtZS9rZXkgdG8gc2V0LCBzdWNoIGFzIGFuIGV2ZW50IG9yIGF0dHJpYnV0ZSBuYW1lXG4gKlx0QHBhcmFtIHthbnl9IG9sZFx0VGhlIGxhc3QgdmFsdWUgdGhhdCB3YXMgc2V0IGZvciB0aGlzIG5hbWUvbm9kZSBwYWlyXG4gKlx0QHBhcmFtIHthbnl9IHZhbHVlXHRBbiBhdHRyaWJ1dGUgdmFsdWUsIHN1Y2ggYXMgYSBmdW5jdGlvbiB0byBiZSB1c2VkIGFzIGFuIGV2ZW50IGhhbmRsZXJcbiAqXHRAcGFyYW0ge0Jvb2xlYW59IGlzU3ZnXHRBcmUgd2UgY3VycmVudGx5IGRpZmZpbmcgaW5zaWRlIGFuIHN2Zz9cbiAqXHRAcHJpdmF0ZVxuICovXG5leHBvcnQgZnVuY3Rpb24gc2V0QWNjZXNzb3Iobm9kZSwgbmFtZSwgb2xkLCB2YWx1ZSwgaXNTdmcpIHtcblx0aWYgKG5hbWU9PT0nY2xhc3NOYW1lJykgbmFtZSA9ICdjbGFzcyc7XG5cblxuXHRpZiAobmFtZT09PSdrZXknKSB7XG5cdFx0Ly8gaWdub3JlXG5cdH1cblx0ZWxzZSBpZiAobmFtZT09PSdyZWYnKSB7XG5cdFx0aWYgKG9sZCkgb2xkKG51bGwpO1xuXHRcdGlmICh2YWx1ZSkgdmFsdWUobm9kZSk7XG5cdH1cblx0ZWxzZSBpZiAobmFtZT09PSdjbGFzcycgJiYgIWlzU3ZnKSB7XG5cdFx0bm9kZS5jbGFzc05hbWUgPSB2YWx1ZSB8fCAnJztcblx0fVxuXHRlbHNlIGlmIChuYW1lPT09J3N0eWxlJykge1xuXHRcdGlmICghdmFsdWUgfHwgdHlwZW9mIHZhbHVlPT09J3N0cmluZycgfHwgdHlwZW9mIG9sZD09PSdzdHJpbmcnKSB7XG5cdFx0XHRub2RlLnN0eWxlLmNzc1RleHQgPSB2YWx1ZSB8fCAnJztcblx0XHR9XG5cdFx0aWYgKHZhbHVlICYmIHR5cGVvZiB2YWx1ZT09PSdvYmplY3QnKSB7XG5cdFx0XHRpZiAodHlwZW9mIG9sZCE9PSdzdHJpbmcnKSB7XG5cdFx0XHRcdGZvciAobGV0IGkgaW4gb2xkKSBpZiAoIShpIGluIHZhbHVlKSkgbm9kZS5zdHlsZVtpXSA9ICcnO1xuXHRcdFx0fVxuXHRcdFx0Zm9yIChsZXQgaSBpbiB2YWx1ZSkge1xuXHRcdFx0XHRub2RlLnN0eWxlW2ldID0gdHlwZW9mIHZhbHVlW2ldPT09J251bWJlcicgJiYgSVNfTk9OX0RJTUVOU0lPTkFMLnRlc3QoaSk9PT1mYWxzZSA/ICh2YWx1ZVtpXSsncHgnKSA6IHZhbHVlW2ldO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXHRlbHNlIGlmIChuYW1lPT09J2Rhbmdlcm91c2x5U2V0SW5uZXJIVE1MJykge1xuXHRcdGlmICh2YWx1ZSkgbm9kZS5pbm5lckhUTUwgPSB2YWx1ZS5fX2h0bWwgfHwgJyc7XG5cdH1cblx0ZWxzZSBpZiAobmFtZVswXT09J28nICYmIG5hbWVbMV09PSduJykge1xuXHRcdGxldCB1c2VDYXB0dXJlID0gbmFtZSAhPT0gKG5hbWU9bmFtZS5yZXBsYWNlKC9DYXB0dXJlJC8sICcnKSk7XG5cdFx0bmFtZSA9IG5hbWUudG9Mb3dlckNhc2UoKS5zdWJzdHJpbmcoMik7XG5cdFx0aWYgKHZhbHVlKSB7XG5cdFx0XHRpZiAoIW9sZCkgbm9kZS5hZGRFdmVudExpc3RlbmVyKG5hbWUsIGV2ZW50UHJveHksIHVzZUNhcHR1cmUpO1xuXHRcdH1cblx0XHRlbHNlIHtcblx0XHRcdG5vZGUucmVtb3ZlRXZlbnRMaXN0ZW5lcihuYW1lLCBldmVudFByb3h5LCB1c2VDYXB0dXJlKTtcblx0XHR9XG5cdFx0KG5vZGUuX2xpc3RlbmVycyB8fCAobm9kZS5fbGlzdGVuZXJzID0ge30pKVtuYW1lXSA9IHZhbHVlO1xuXHR9XG5cdGVsc2UgaWYgKG5hbWUhPT0nbGlzdCcgJiYgbmFtZSE9PSd0eXBlJyAmJiAhaXNTdmcgJiYgbmFtZSBpbiBub2RlKSB7XG5cdFx0c2V0UHJvcGVydHkobm9kZSwgbmFtZSwgdmFsdWU9PW51bGwgPyAnJyA6IHZhbHVlKTtcblx0XHRpZiAodmFsdWU9PW51bGwgfHwgdmFsdWU9PT1mYWxzZSkgbm9kZS5yZW1vdmVBdHRyaWJ1dGUobmFtZSk7XG5cdH1cblx0ZWxzZSB7XG5cdFx0bGV0IG5zID0gaXNTdmcgJiYgKG5hbWUgIT09IChuYW1lID0gbmFtZS5yZXBsYWNlKC9eeGxpbmtcXDo/LywgJycpKSk7XG5cdFx0aWYgKHZhbHVlPT1udWxsIHx8IHZhbHVlPT09ZmFsc2UpIHtcblx0XHRcdGlmIChucykgbm9kZS5yZW1vdmVBdHRyaWJ1dGVOUygnaHR0cDovL3d3dy53My5vcmcvMTk5OS94bGluaycsIG5hbWUudG9Mb3dlckNhc2UoKSk7XG5cdFx0XHRlbHNlIG5vZGUucmVtb3ZlQXR0cmlidXRlKG5hbWUpO1xuXHRcdH1cblx0XHRlbHNlIGlmICh0eXBlb2YgdmFsdWUhPT0nZnVuY3Rpb24nKSB7XG5cdFx0XHRpZiAobnMpIG5vZGUuc2V0QXR0cmlidXRlTlMoJ2h0dHA6Ly93d3cudzMub3JnLzE5OTkveGxpbmsnLCBuYW1lLnRvTG93ZXJDYXNlKCksIHZhbHVlKTtcblx0XHRcdGVsc2Ugbm9kZS5zZXRBdHRyaWJ1dGUobmFtZSwgdmFsdWUpO1xuXHRcdH1cblx0fVxufVxuXG5cbi8qKiBBdHRlbXB0IHRvIHNldCBhIERPTSBwcm9wZXJ0eSB0byB0aGUgZ2l2ZW4gdmFsdWUuXG4gKlx0SUUgJiBGRiB0aHJvdyBmb3IgY2VydGFpbiBwcm9wZXJ0eS12YWx1ZSBjb21iaW5hdGlvbnMuXG4gKi9cbmZ1bmN0aW9uIHNldFByb3BlcnR5KG5vZGUsIG5hbWUsIHZhbHVlKSB7XG5cdHRyeSB7XG5cdFx0bm9kZVtuYW1lXSA9IHZhbHVlO1xuXHR9IGNhdGNoIChlKSB7IH1cbn1cblxuXG4vKiogUHJveHkgYW4gZXZlbnQgdG8gaG9va2VkIGV2ZW50IGhhbmRsZXJzXG4gKlx0QHByaXZhdGVcbiAqL1xuZnVuY3Rpb24gZXZlbnRQcm94eShlKSB7XG5cdHJldHVybiB0aGlzLl9saXN0ZW5lcnNbZS50eXBlXShvcHRpb25zLmV2ZW50ICYmIG9wdGlvbnMuZXZlbnQoZSkgfHwgZSk7XG59XG4iLCJpbXBvcnQgeyBBVFRSX0tFWSB9IGZyb20gJy4uL2NvbnN0YW50cyc7XG5pbXBvcnQgeyBpc1NhbWVOb2RlVHlwZSwgaXNOYW1lZE5vZGUgfSBmcm9tICcuL2luZGV4JztcbmltcG9ydCB7IGJ1aWxkQ29tcG9uZW50RnJvbVZOb2RlIH0gZnJvbSAnLi9jb21wb25lbnQnO1xuaW1wb3J0IHsgY3JlYXRlTm9kZSwgc2V0QWNjZXNzb3IgfSBmcm9tICcuLi9kb20vaW5kZXgnO1xuaW1wb3J0IHsgdW5tb3VudENvbXBvbmVudCB9IGZyb20gJy4vY29tcG9uZW50JztcbmltcG9ydCBvcHRpb25zIGZyb20gJy4uL29wdGlvbnMnO1xuaW1wb3J0IHsgcmVtb3ZlTm9kZSB9IGZyb20gJy4uL2RvbSc7XG5cbi8qKiBRdWV1ZSBvZiBjb21wb25lbnRzIHRoYXQgaGF2ZSBiZWVuIG1vdW50ZWQgYW5kIGFyZSBhd2FpdGluZyBjb21wb25lbnREaWRNb3VudCAqL1xuZXhwb3J0IGNvbnN0IG1vdW50cyA9IFtdO1xuXG4vKiogRGlmZiByZWN1cnNpb24gY291bnQsIHVzZWQgdG8gdHJhY2sgdGhlIGVuZCBvZiB0aGUgZGlmZiBjeWNsZS4gKi9cbmV4cG9ydCBsZXQgZGlmZkxldmVsID0gMDtcblxuLyoqIEdsb2JhbCBmbGFnIGluZGljYXRpbmcgaWYgdGhlIGRpZmYgaXMgY3VycmVudGx5IHdpdGhpbiBhbiBTVkcgKi9cbmxldCBpc1N2Z01vZGUgPSBmYWxzZTtcblxuLyoqIEdsb2JhbCBmbGFnIGluZGljYXRpbmcgaWYgdGhlIGRpZmYgaXMgcGVyZm9ybWluZyBoeWRyYXRpb24gKi9cbmxldCBoeWRyYXRpbmcgPSBmYWxzZTtcblxuLyoqIEludm9rZSBxdWV1ZWQgY29tcG9uZW50RGlkTW91bnQgbGlmZWN5Y2xlIG1ldGhvZHMgKi9cbmV4cG9ydCBmdW5jdGlvbiBmbHVzaE1vdW50cygpIHtcblx0bGV0IGM7XG5cdHdoaWxlICgoYz1tb3VudHMucG9wKCkpKSB7XG5cdFx0aWYgKG9wdGlvbnMuYWZ0ZXJNb3VudCkgb3B0aW9ucy5hZnRlck1vdW50KGMpO1xuXHRcdGlmIChjLmNvbXBvbmVudERpZE1vdW50KSBjLmNvbXBvbmVudERpZE1vdW50KCk7XG5cdH1cbn1cblxuXG4vKiogQXBwbHkgZGlmZmVyZW5jZXMgaW4gYSBnaXZlbiB2bm9kZSAoYW5kIGl0J3MgZGVlcCBjaGlsZHJlbikgdG8gYSByZWFsIERPTSBOb2RlLlxuICpcdEBwYXJhbSB7RWxlbWVudH0gW2RvbT1udWxsXVx0XHRBIERPTSBub2RlIHRvIG11dGF0ZSBpbnRvIHRoZSBzaGFwZSBvZiB0aGUgYHZub2RlYFxuICpcdEBwYXJhbSB7Vk5vZGV9IHZub2RlXHRcdFx0QSBWTm9kZSAod2l0aCBkZXNjZW5kYW50cyBmb3JtaW5nIGEgdHJlZSkgcmVwcmVzZW50aW5nIHRoZSBkZXNpcmVkIERPTSBzdHJ1Y3R1cmVcbiAqXHRAcmV0dXJucyB7RWxlbWVudH0gZG9tXHRcdFx0VGhlIGNyZWF0ZWQvbXV0YXRlZCBlbGVtZW50XG4gKlx0QHByaXZhdGVcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGRpZmYoZG9tLCB2bm9kZSwgY29udGV4dCwgbW91bnRBbGwsIHBhcmVudCwgY29tcG9uZW50Um9vdCkge1xuXHQvLyBkaWZmTGV2ZWwgaGF2aW5nIGJlZW4gMCBoZXJlIGluZGljYXRlcyBpbml0aWFsIGVudHJ5IGludG8gdGhlIGRpZmYgKG5vdCBhIHN1YmRpZmYpXG5cdGlmICghZGlmZkxldmVsKyspIHtcblx0XHQvLyB3aGVuIGZpcnN0IHN0YXJ0aW5nIHRoZSBkaWZmLCBjaGVjayBpZiB3ZSdyZSBkaWZmaW5nIGFuIFNWRyBvciB3aXRoaW4gYW4gU1ZHXG5cdFx0aXNTdmdNb2RlID0gcGFyZW50IT1udWxsICYmIHBhcmVudC5vd25lclNWR0VsZW1lbnQhPT11bmRlZmluZWQ7XG5cblx0XHQvLyBoeWRyYXRpb24gaXMgaW5pZGljYXRlZCBieSB0aGUgZXhpc3RpbmcgZWxlbWVudCB0byBiZSBkaWZmZWQgbm90IGhhdmluZyBhIHByb3AgY2FjaGVcblx0XHRoeWRyYXRpbmcgPSBkb20hPW51bGwgJiYgIShBVFRSX0tFWSBpbiBkb20pO1xuXHR9XG5cblx0bGV0IHJldCA9IGlkaWZmKGRvbSwgdm5vZGUsIGNvbnRleHQsIG1vdW50QWxsLCBjb21wb25lbnRSb290KTtcblxuXHQvLyBhcHBlbmQgdGhlIGVsZW1lbnQgaWYgaXRzIGEgbmV3IHBhcmVudFxuXHRpZiAocGFyZW50ICYmIHJldC5wYXJlbnROb2RlIT09cGFyZW50KSBwYXJlbnQuYXBwZW5kQ2hpbGQocmV0KTtcblxuXHQvLyBkaWZmTGV2ZWwgYmVpbmcgcmVkdWNlZCB0byAwIG1lYW5zIHdlJ3JlIGV4aXRpbmcgdGhlIGRpZmZcblx0aWYgKCEtLWRpZmZMZXZlbCkge1xuXHRcdGh5ZHJhdGluZyA9IGZhbHNlO1xuXHRcdC8vIGludm9rZSBxdWV1ZWQgY29tcG9uZW50RGlkTW91bnQgbGlmZWN5Y2xlIG1ldGhvZHNcblx0XHRpZiAoIWNvbXBvbmVudFJvb3QpIGZsdXNoTW91bnRzKCk7XG5cdH1cblxuXHRyZXR1cm4gcmV0O1xufVxuXG5cbi8qKiBJbnRlcm5hbHMgb2YgYGRpZmYoKWAsIHNlcGFyYXRlZCB0byBhbGxvdyBieXBhc3NpbmcgZGlmZkxldmVsIC8gbW91bnQgZmx1c2hpbmcuICovXG5mdW5jdGlvbiBpZGlmZihkb20sIHZub2RlLCBjb250ZXh0LCBtb3VudEFsbCwgY29tcG9uZW50Um9vdCkge1xuXHRsZXQgb3V0ID0gZG9tLFxuXHRcdHByZXZTdmdNb2RlID0gaXNTdmdNb2RlO1xuXG5cdC8vIGVtcHR5IHZhbHVlcyAobnVsbCAmIHVuZGVmaW5lZCkgcmVuZGVyIGFzIGVtcHR5IFRleHQgbm9kZXNcblx0aWYgKHZub2RlPT1udWxsKSB2bm9kZSA9ICcnO1xuXG5cblx0Ly8gRmFzdCBjYXNlOiBTdHJpbmdzIGNyZWF0ZS91cGRhdGUgVGV4dCBub2Rlcy5cblx0aWYgKHR5cGVvZiB2bm9kZT09PSdzdHJpbmcnKSB7XG5cblx0XHQvLyB1cGRhdGUgaWYgaXQncyBhbHJlYWR5IGEgVGV4dCBub2RlOlxuXHRcdGlmIChkb20gJiYgZG9tLnNwbGl0VGV4dCE9PXVuZGVmaW5lZCAmJiBkb20ucGFyZW50Tm9kZSAmJiAoIWRvbS5fY29tcG9uZW50IHx8IGNvbXBvbmVudFJvb3QpKSB7XG5cdFx0XHRpZiAoZG9tLm5vZGVWYWx1ZSE9dm5vZGUpIHtcblx0XHRcdFx0ZG9tLm5vZGVWYWx1ZSA9IHZub2RlO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRlbHNlIHtcblx0XHRcdC8vIGl0IHdhc24ndCBhIFRleHQgbm9kZTogcmVwbGFjZSBpdCB3aXRoIG9uZSBhbmQgcmVjeWNsZSB0aGUgb2xkIEVsZW1lbnRcblx0XHRcdG91dCA9IGRvY3VtZW50LmNyZWF0ZVRleHROb2RlKHZub2RlKTtcblx0XHRcdGlmIChkb20pIHtcblx0XHRcdFx0aWYgKGRvbS5wYXJlbnROb2RlKSBkb20ucGFyZW50Tm9kZS5yZXBsYWNlQ2hpbGQob3V0LCBkb20pO1xuXHRcdFx0XHRyZWNvbGxlY3ROb2RlVHJlZShkb20sIHRydWUpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdG91dFtBVFRSX0tFWV0gPSB0cnVlO1xuXG5cdFx0cmV0dXJuIG91dDtcblx0fVxuXG5cblx0Ly8gSWYgdGhlIFZOb2RlIHJlcHJlc2VudHMgYSBDb21wb25lbnQsIHBlcmZvcm0gYSBjb21wb25lbnQgZGlmZjpcblx0aWYgKHR5cGVvZiB2bm9kZS5ub2RlTmFtZT09PSdmdW5jdGlvbicpIHtcblx0XHRyZXR1cm4gYnVpbGRDb21wb25lbnRGcm9tVk5vZGUoZG9tLCB2bm9kZSwgY29udGV4dCwgbW91bnRBbGwpO1xuXHR9XG5cblxuXHQvLyBUcmFja3MgZW50ZXJpbmcgYW5kIGV4aXRpbmcgU1ZHIG5hbWVzcGFjZSB3aGVuIGRlc2NlbmRpbmcgdGhyb3VnaCB0aGUgdHJlZS5cblx0aXNTdmdNb2RlID0gdm5vZGUubm9kZU5hbWU9PT0nc3ZnJyA/IHRydWUgOiB2bm9kZS5ub2RlTmFtZT09PSdmb3JlaWduT2JqZWN0JyA/IGZhbHNlIDogaXNTdmdNb2RlO1xuXG5cblx0Ly8gSWYgdGhlcmUncyBubyBleGlzdGluZyBlbGVtZW50IG9yIGl0J3MgdGhlIHdyb25nIHR5cGUsIGNyZWF0ZSBhIG5ldyBvbmU6XG5cdGlmICghZG9tIHx8ICFpc05hbWVkTm9kZShkb20sIFN0cmluZyh2bm9kZS5ub2RlTmFtZSkpKSB7XG5cdFx0b3V0ID0gY3JlYXRlTm9kZShTdHJpbmcodm5vZGUubm9kZU5hbWUpLCBpc1N2Z01vZGUpO1xuXG5cdFx0aWYgKGRvbSkge1xuXHRcdFx0Ly8gbW92ZSBjaGlsZHJlbiBpbnRvIHRoZSByZXBsYWNlbWVudCBub2RlXG5cdFx0XHR3aGlsZSAoZG9tLmZpcnN0Q2hpbGQpIG91dC5hcHBlbmRDaGlsZChkb20uZmlyc3RDaGlsZCk7XG5cblx0XHRcdC8vIGlmIHRoZSBwcmV2aW91cyBFbGVtZW50IHdhcyBtb3VudGVkIGludG8gdGhlIERPTSwgcmVwbGFjZSBpdCBpbmxpbmVcblx0XHRcdGlmIChkb20ucGFyZW50Tm9kZSkgZG9tLnBhcmVudE5vZGUucmVwbGFjZUNoaWxkKG91dCwgZG9tKTtcblxuXHRcdFx0Ly8gcmVjeWNsZSB0aGUgb2xkIGVsZW1lbnQgKHNraXBzIG5vbi1FbGVtZW50IG5vZGUgdHlwZXMpXG5cdFx0XHRyZWNvbGxlY3ROb2RlVHJlZShkb20sIHRydWUpO1xuXHRcdH1cblx0fVxuXG5cblx0bGV0IGZjID0gb3V0LmZpcnN0Q2hpbGQsXG5cdFx0cHJvcHMgPSBvdXRbQVRUUl9LRVldIHx8IChvdXRbQVRUUl9LRVldID0ge30pLFxuXHRcdHZjaGlsZHJlbiA9IHZub2RlLmNoaWxkcmVuO1xuXG5cdC8vIE9wdGltaXphdGlvbjogZmFzdC1wYXRoIGZvciBlbGVtZW50cyBjb250YWluaW5nIGEgc2luZ2xlIFRleHROb2RlOlxuXHRpZiAoIWh5ZHJhdGluZyAmJiB2Y2hpbGRyZW4gJiYgdmNoaWxkcmVuLmxlbmd0aD09PTEgJiYgdHlwZW9mIHZjaGlsZHJlblswXT09PSdzdHJpbmcnICYmIGZjIT1udWxsICYmIGZjLnNwbGl0VGV4dCE9PXVuZGVmaW5lZCAmJiBmYy5uZXh0U2libGluZz09bnVsbCkge1xuXHRcdGlmIChmYy5ub2RlVmFsdWUhPXZjaGlsZHJlblswXSkge1xuXHRcdFx0ZmMubm9kZVZhbHVlID0gdmNoaWxkcmVuWzBdO1xuXHRcdH1cblx0fVxuXHQvLyBvdGhlcndpc2UsIGlmIHRoZXJlIGFyZSBleGlzdGluZyBvciBuZXcgY2hpbGRyZW4sIGRpZmYgdGhlbTpcblx0ZWxzZSBpZiAodmNoaWxkcmVuICYmIHZjaGlsZHJlbi5sZW5ndGggfHwgZmMhPW51bGwpIHtcblx0XHRpbm5lckRpZmZOb2RlKG91dCwgdmNoaWxkcmVuLCBjb250ZXh0LCBtb3VudEFsbCwgaHlkcmF0aW5nIHx8IHByb3BzLmRhbmdlcm91c2x5U2V0SW5uZXJIVE1MIT1udWxsKTtcblx0fVxuXG5cblx0Ly8gQXBwbHkgYXR0cmlidXRlcy9wcm9wcyBmcm9tIFZOb2RlIHRvIHRoZSBET00gRWxlbWVudDpcblx0ZGlmZkF0dHJpYnV0ZXMob3V0LCB2bm9kZS5hdHRyaWJ1dGVzLCBwcm9wcyk7XG5cblxuXHQvLyByZXN0b3JlIHByZXZpb3VzIFNWRyBtb2RlOiAoaW4gY2FzZSB3ZSdyZSBleGl0aW5nIGFuIFNWRyBuYW1lc3BhY2UpXG5cdGlzU3ZnTW9kZSA9IHByZXZTdmdNb2RlO1xuXG5cdHJldHVybiBvdXQ7XG59XG5cblxuLyoqIEFwcGx5IGNoaWxkIGFuZCBhdHRyaWJ1dGUgY2hhbmdlcyBiZXR3ZWVuIGEgVk5vZGUgYW5kIGEgRE9NIE5vZGUgdG8gdGhlIERPTS5cbiAqXHRAcGFyYW0ge0VsZW1lbnR9IGRvbVx0XHRcdEVsZW1lbnQgd2hvc2UgY2hpbGRyZW4gc2hvdWxkIGJlIGNvbXBhcmVkICYgbXV0YXRlZFxuICpcdEBwYXJhbSB7QXJyYXl9IHZjaGlsZHJlblx0XHRBcnJheSBvZiBWTm9kZXMgdG8gY29tcGFyZSB0byBgZG9tLmNoaWxkTm9kZXNgXG4gKlx0QHBhcmFtIHtPYmplY3R9IGNvbnRleHRcdFx0XHRJbXBsaWNpdGx5IGRlc2NlbmRhbnQgY29udGV4dCBvYmplY3QgKGZyb20gbW9zdCByZWNlbnQgYGdldENoaWxkQ29udGV4dCgpYClcbiAqXHRAcGFyYW0ge0Jvb2xlYW59IG1vdW50QWxsXG4gKlx0QHBhcmFtIHtCb29sZWFufSBpc0h5ZHJhdGluZ1x0SWYgYHRydWVgLCBjb25zdW1lcyBleHRlcm5hbGx5IGNyZWF0ZWQgZWxlbWVudHMgc2ltaWxhciB0byBoeWRyYXRpb25cbiAqL1xuZnVuY3Rpb24gaW5uZXJEaWZmTm9kZShkb20sIHZjaGlsZHJlbiwgY29udGV4dCwgbW91bnRBbGwsIGlzSHlkcmF0aW5nKSB7XG5cdGxldCBvcmlnaW5hbENoaWxkcmVuID0gZG9tLmNoaWxkTm9kZXMsXG5cdFx0Y2hpbGRyZW4gPSBbXSxcblx0XHRrZXllZCA9IHt9LFxuXHRcdGtleWVkTGVuID0gMCxcblx0XHRtaW4gPSAwLFxuXHRcdGxlbiA9IG9yaWdpbmFsQ2hpbGRyZW4ubGVuZ3RoLFxuXHRcdGNoaWxkcmVuTGVuID0gMCxcblx0XHR2bGVuID0gdmNoaWxkcmVuID8gdmNoaWxkcmVuLmxlbmd0aCA6IDAsXG5cdFx0aiwgYywgdmNoaWxkLCBjaGlsZDtcblxuXHQvLyBCdWlsZCB1cCBhIG1hcCBvZiBrZXllZCBjaGlsZHJlbiBhbmQgYW4gQXJyYXkgb2YgdW5rZXllZCBjaGlsZHJlbjpcblx0aWYgKGxlbiE9PTApIHtcblx0XHRmb3IgKGxldCBpPTA7IGk8bGVuOyBpKyspIHtcblx0XHRcdGxldCBjaGlsZCA9IG9yaWdpbmFsQ2hpbGRyZW5baV0sXG5cdFx0XHRcdHByb3BzID0gY2hpbGRbQVRUUl9LRVldLFxuXHRcdFx0XHRrZXkgPSB2bGVuICYmIHByb3BzID8gY2hpbGQuX2NvbXBvbmVudCA/IGNoaWxkLl9jb21wb25lbnQuX19rZXkgOiBwcm9wcy5rZXkgOiBudWxsO1xuXHRcdFx0aWYgKGtleSE9bnVsbCkge1xuXHRcdFx0XHRrZXllZExlbisrO1xuXHRcdFx0XHRrZXllZFtrZXldID0gY2hpbGQ7XG5cdFx0XHR9XG5cdFx0XHRlbHNlIGlmIChwcm9wcyB8fCAoY2hpbGQuc3BsaXRUZXh0IT09dW5kZWZpbmVkID8gKGlzSHlkcmF0aW5nID8gY2hpbGQubm9kZVZhbHVlLnRyaW0oKSA6IHRydWUpIDogaXNIeWRyYXRpbmcpKSB7XG5cdFx0XHRcdGNoaWxkcmVuW2NoaWxkcmVuTGVuKytdID0gY2hpbGQ7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0aWYgKHZsZW4hPT0wKSB7XG5cdFx0Zm9yIChsZXQgaT0wOyBpPHZsZW47IGkrKykge1xuXHRcdFx0dmNoaWxkID0gdmNoaWxkcmVuW2ldO1xuXHRcdFx0Y2hpbGQgPSBudWxsO1xuXG5cdFx0XHQvLyBhdHRlbXB0IHRvIGZpbmQgYSBub2RlIGJhc2VkIG9uIGtleSBtYXRjaGluZ1xuXHRcdFx0bGV0IGtleSA9IHZjaGlsZC5rZXk7XG5cdFx0XHRpZiAoa2V5IT1udWxsKSB7XG5cdFx0XHRcdGlmIChrZXllZExlbiAmJiBrZXllZFtrZXldIT09dW5kZWZpbmVkKSB7XG5cdFx0XHRcdFx0Y2hpbGQgPSBrZXllZFtrZXldO1xuXHRcdFx0XHRcdGtleWVkW2tleV0gPSB1bmRlZmluZWQ7XG5cdFx0XHRcdFx0a2V5ZWRMZW4tLTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0Ly8gYXR0ZW1wdCB0byBwbHVjayBhIG5vZGUgb2YgdGhlIHNhbWUgdHlwZSBmcm9tIHRoZSBleGlzdGluZyBjaGlsZHJlblxuXHRcdFx0ZWxzZSBpZiAoIWNoaWxkICYmIG1pbjxjaGlsZHJlbkxlbikge1xuXHRcdFx0XHRmb3IgKGo9bWluOyBqPGNoaWxkcmVuTGVuOyBqKyspIHtcblx0XHRcdFx0XHRpZiAoY2hpbGRyZW5bal0hPT11bmRlZmluZWQgJiYgaXNTYW1lTm9kZVR5cGUoYyA9IGNoaWxkcmVuW2pdLCB2Y2hpbGQsIGlzSHlkcmF0aW5nKSkge1xuXHRcdFx0XHRcdFx0Y2hpbGQgPSBjO1xuXHRcdFx0XHRcdFx0Y2hpbGRyZW5bal0gPSB1bmRlZmluZWQ7XG5cdFx0XHRcdFx0XHRpZiAoaj09PWNoaWxkcmVuTGVuLTEpIGNoaWxkcmVuTGVuLS07XG5cdFx0XHRcdFx0XHRpZiAoaj09PW1pbikgbWluKys7XG5cdFx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0Ly8gbW9ycGggdGhlIG1hdGNoZWQvZm91bmQvY3JlYXRlZCBET00gY2hpbGQgdG8gbWF0Y2ggdmNoaWxkIChkZWVwKVxuXHRcdFx0Y2hpbGQgPSBpZGlmZihjaGlsZCwgdmNoaWxkLCBjb250ZXh0LCBtb3VudEFsbCk7XG5cblx0XHRcdGlmIChjaGlsZCAmJiBjaGlsZCE9PWRvbSkge1xuXHRcdFx0XHRpZiAoaT49bGVuKSB7XG5cdFx0XHRcdFx0ZG9tLmFwcGVuZENoaWxkKGNoaWxkKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRlbHNlIGlmIChjaGlsZCE9PW9yaWdpbmFsQ2hpbGRyZW5baV0pIHtcblx0XHRcdFx0XHRpZiAoY2hpbGQ9PT1vcmlnaW5hbENoaWxkcmVuW2krMV0pIHtcblx0XHRcdFx0XHRcdHJlbW92ZU5vZGUob3JpZ2luYWxDaGlsZHJlbltpXSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGVsc2Uge1xuXHRcdFx0XHRcdFx0ZG9tLmluc2VydEJlZm9yZShjaGlsZCwgb3JpZ2luYWxDaGlsZHJlbltpXSB8fCBudWxsKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXG5cdC8vIHJlbW92ZSB1bnVzZWQga2V5ZWQgY2hpbGRyZW46XG5cdGlmIChrZXllZExlbikge1xuXHRcdGZvciAobGV0IGkgaW4ga2V5ZWQpIGlmIChrZXllZFtpXSE9PXVuZGVmaW5lZCkgcmVjb2xsZWN0Tm9kZVRyZWUoa2V5ZWRbaV0sIGZhbHNlKTtcblx0fVxuXG5cdC8vIHJlbW92ZSBvcnBoYW5lZCB1bmtleWVkIGNoaWxkcmVuOlxuXHR3aGlsZSAobWluPD1jaGlsZHJlbkxlbikge1xuXHRcdGlmICgoY2hpbGQgPSBjaGlsZHJlbltjaGlsZHJlbkxlbi0tXSkhPT11bmRlZmluZWQpIHJlY29sbGVjdE5vZGVUcmVlKGNoaWxkLCBmYWxzZSk7XG5cdH1cbn1cblxuXG5cbi8qKiBSZWN1cnNpdmVseSByZWN5Y2xlIChvciBqdXN0IHVubW91bnQpIGEgbm9kZSBhbiBpdHMgZGVzY2VuZGFudHMuXG4gKlx0QHBhcmFtIHtOb2RlfSBub2RlXHRcdFx0XHRcdFx0RE9NIG5vZGUgdG8gc3RhcnQgdW5tb3VudC9yZW1vdmFsIGZyb21cbiAqXHRAcGFyYW0ge0Jvb2xlYW59IFt1bm1vdW50T25seT1mYWxzZV1cdElmIGB0cnVlYCwgb25seSB0cmlnZ2VycyB1bm1vdW50IGxpZmVjeWNsZSwgc2tpcHMgcmVtb3ZhbFxuICovXG5leHBvcnQgZnVuY3Rpb24gcmVjb2xsZWN0Tm9kZVRyZWUobm9kZSwgdW5tb3VudE9ubHkpIHtcblx0bGV0IGNvbXBvbmVudCA9IG5vZGUuX2NvbXBvbmVudDtcblx0aWYgKGNvbXBvbmVudCkge1xuXHRcdC8vIGlmIG5vZGUgaXMgb3duZWQgYnkgYSBDb21wb25lbnQsIHVubW91bnQgdGhhdCBjb21wb25lbnQgKGVuZHMgdXAgcmVjdXJzaW5nIGJhY2sgaGVyZSlcblx0XHR1bm1vdW50Q29tcG9uZW50KGNvbXBvbmVudCk7XG5cdH1cblx0ZWxzZSB7XG5cdFx0Ly8gSWYgdGhlIG5vZGUncyBWTm9kZSBoYWQgYSByZWYgZnVuY3Rpb24sIGludm9rZSBpdCB3aXRoIG51bGwgaGVyZS5cblx0XHQvLyAodGhpcyBpcyBwYXJ0IG9mIHRoZSBSZWFjdCBzcGVjLCBhbmQgc21hcnQgZm9yIHVuc2V0dGluZyByZWZlcmVuY2VzKVxuXHRcdGlmIChub2RlW0FUVFJfS0VZXSE9bnVsbCAmJiBub2RlW0FUVFJfS0VZXS5yZWYpIG5vZGVbQVRUUl9LRVldLnJlZihudWxsKTtcblxuXHRcdGlmICh1bm1vdW50T25seT09PWZhbHNlIHx8IG5vZGVbQVRUUl9LRVldPT1udWxsKSB7XG5cdFx0XHRyZW1vdmVOb2RlKG5vZGUpO1xuXHRcdH1cblxuXHRcdHJlbW92ZUNoaWxkcmVuKG5vZGUpO1xuXHR9XG59XG5cblxuLyoqIFJlY29sbGVjdC91bm1vdW50IGFsbCBjaGlsZHJlbi5cbiAqXHQtIHdlIHVzZSAubGFzdENoaWxkIGhlcmUgYmVjYXVzZSBpdCBjYXVzZXMgbGVzcyByZWZsb3cgdGhhbiAuZmlyc3RDaGlsZFxuICpcdC0gaXQncyBhbHNvIGNoZWFwZXIgdGhhbiBhY2Nlc3NpbmcgdGhlIC5jaGlsZE5vZGVzIExpdmUgTm9kZUxpc3RcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHJlbW92ZUNoaWxkcmVuKG5vZGUpIHtcblx0bm9kZSA9IG5vZGUubGFzdENoaWxkO1xuXHR3aGlsZSAobm9kZSkge1xuXHRcdGxldCBuZXh0ID0gbm9kZS5wcmV2aW91c1NpYmxpbmc7XG5cdFx0cmVjb2xsZWN0Tm9kZVRyZWUobm9kZSwgdHJ1ZSk7XG5cdFx0bm9kZSA9IG5leHQ7XG5cdH1cbn1cblxuXG4vKiogQXBwbHkgZGlmZmVyZW5jZXMgaW4gYXR0cmlidXRlcyBmcm9tIGEgVk5vZGUgdG8gdGhlIGdpdmVuIERPTSBFbGVtZW50LlxuICpcdEBwYXJhbSB7RWxlbWVudH0gZG9tXHRcdEVsZW1lbnQgd2l0aCBhdHRyaWJ1dGVzIHRvIGRpZmYgYGF0dHJzYCBhZ2FpbnN0XG4gKlx0QHBhcmFtIHtPYmplY3R9IGF0dHJzXHRcdFRoZSBkZXNpcmVkIGVuZC1zdGF0ZSBrZXktdmFsdWUgYXR0cmlidXRlIHBhaXJzXG4gKlx0QHBhcmFtIHtPYmplY3R9IG9sZFx0XHRcdEN1cnJlbnQvcHJldmlvdXMgYXR0cmlidXRlcyAoZnJvbSBwcmV2aW91cyBWTm9kZSBvciBlbGVtZW50J3MgcHJvcCBjYWNoZSlcbiAqL1xuZnVuY3Rpb24gZGlmZkF0dHJpYnV0ZXMoZG9tLCBhdHRycywgb2xkKSB7XG5cdGxldCBuYW1lO1xuXG5cdC8vIHJlbW92ZSBhdHRyaWJ1dGVzIG5vIGxvbmdlciBwcmVzZW50IG9uIHRoZSB2bm9kZSBieSBzZXR0aW5nIHRoZW0gdG8gdW5kZWZpbmVkXG5cdGZvciAobmFtZSBpbiBvbGQpIHtcblx0XHRpZiAoIShhdHRycyAmJiBhdHRyc1tuYW1lXSE9bnVsbCkgJiYgb2xkW25hbWVdIT1udWxsKSB7XG5cdFx0XHRzZXRBY2Nlc3Nvcihkb20sIG5hbWUsIG9sZFtuYW1lXSwgb2xkW25hbWVdID0gdW5kZWZpbmVkLCBpc1N2Z01vZGUpO1xuXHRcdH1cblx0fVxuXG5cdC8vIGFkZCBuZXcgJiB1cGRhdGUgY2hhbmdlZCBhdHRyaWJ1dGVzXG5cdGZvciAobmFtZSBpbiBhdHRycykge1xuXHRcdGlmIChuYW1lIT09J2NoaWxkcmVuJyAmJiBuYW1lIT09J2lubmVySFRNTCcgJiYgKCEobmFtZSBpbiBvbGQpIHx8IGF0dHJzW25hbWVdIT09KG5hbWU9PT0ndmFsdWUnIHx8IG5hbWU9PT0nY2hlY2tlZCcgPyBkb21bbmFtZV0gOiBvbGRbbmFtZV0pKSkge1xuXHRcdFx0c2V0QWNjZXNzb3IoZG9tLCBuYW1lLCBvbGRbbmFtZV0sIG9sZFtuYW1lXSA9IGF0dHJzW25hbWVdLCBpc1N2Z01vZGUpO1xuXHRcdH1cblx0fVxufVxuIiwiaW1wb3J0IHsgQ29tcG9uZW50IH0gZnJvbSAnLi4vY29tcG9uZW50JztcblxuLyoqIFJldGFpbnMgYSBwb29sIG9mIENvbXBvbmVudHMgZm9yIHJlLXVzZSwga2V5ZWQgb24gY29tcG9uZW50IG5hbWUuXG4gKlx0Tm90ZTogc2luY2UgY29tcG9uZW50IG5hbWVzIGFyZSBub3QgdW5pcXVlIG9yIGV2ZW4gbmVjZXNzYXJpbHkgYXZhaWxhYmxlLCB0aGVzZSBhcmUgcHJpbWFyaWx5IGEgZm9ybSBvZiBzaGFyZGluZy5cbiAqXHRAcHJpdmF0ZVxuICovXG5jb25zdCBjb21wb25lbnRzID0ge307XG5cblxuLyoqIFJlY2xhaW0gYSBjb21wb25lbnQgZm9yIGxhdGVyIHJlLXVzZSBieSB0aGUgcmVjeWNsZXIuICovXG5leHBvcnQgZnVuY3Rpb24gY29sbGVjdENvbXBvbmVudChjb21wb25lbnQpIHtcblx0bGV0IG5hbWUgPSBjb21wb25lbnQuY29uc3RydWN0b3IubmFtZTtcblx0KGNvbXBvbmVudHNbbmFtZV0gfHwgKGNvbXBvbmVudHNbbmFtZV0gPSBbXSkpLnB1c2goY29tcG9uZW50KTtcbn1cblxuXG4vKiogQ3JlYXRlIGEgY29tcG9uZW50LiBOb3JtYWxpemVzIGRpZmZlcmVuY2VzIGJldHdlZW4gUEZDJ3MgYW5kIGNsYXNzZnVsIENvbXBvbmVudHMuICovXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlQ29tcG9uZW50KEN0b3IsIHByb3BzLCBjb250ZXh0KSB7XG5cdGxldCBsaXN0ID0gY29tcG9uZW50c1tDdG9yLm5hbWVdLFxuXHRcdGluc3Q7XG5cblx0aWYgKEN0b3IucHJvdG90eXBlICYmIEN0b3IucHJvdG90eXBlLnJlbmRlcikge1xuXHRcdGluc3QgPSBuZXcgQ3Rvcihwcm9wcywgY29udGV4dCk7XG5cdFx0Q29tcG9uZW50LmNhbGwoaW5zdCwgcHJvcHMsIGNvbnRleHQpO1xuXHR9XG5cdGVsc2Uge1xuXHRcdGluc3QgPSBuZXcgQ29tcG9uZW50KHByb3BzLCBjb250ZXh0KTtcblx0XHRpbnN0LmNvbnN0cnVjdG9yID0gQ3Rvcjtcblx0XHRpbnN0LnJlbmRlciA9IGRvUmVuZGVyO1xuXHR9XG5cblxuXHRpZiAobGlzdCkge1xuXHRcdGZvciAobGV0IGk9bGlzdC5sZW5ndGg7IGktLTsgKSB7XG5cdFx0XHRpZiAobGlzdFtpXS5jb25zdHJ1Y3Rvcj09PUN0b3IpIHtcblx0XHRcdFx0aW5zdC5uZXh0QmFzZSA9IGxpc3RbaV0ubmV4dEJhc2U7XG5cdFx0XHRcdGxpc3Quc3BsaWNlKGksIDEpO1xuXHRcdFx0XHRicmVhaztcblx0XHRcdH1cblx0XHR9XG5cdH1cblx0cmV0dXJuIGluc3Q7XG59XG5cblxuLyoqIFRoZSBgLnJlbmRlcigpYCBtZXRob2QgZm9yIGEgUEZDIGJhY2tpbmcgaW5zdGFuY2UuICovXG5mdW5jdGlvbiBkb1JlbmRlcihwcm9wcywgc3RhdGUsIGNvbnRleHQpIHtcblx0cmV0dXJuIHRoaXMuY29uc3RydWN0b3IocHJvcHMsIGNvbnRleHQpO1xufVxuIiwiaW1wb3J0IHsgU1lOQ19SRU5ERVIsIE5PX1JFTkRFUiwgRk9SQ0VfUkVOREVSLCBBU1lOQ19SRU5ERVIsIEFUVFJfS0VZIH0gZnJvbSAnLi4vY29uc3RhbnRzJztcbmltcG9ydCBvcHRpb25zIGZyb20gJy4uL29wdGlvbnMnO1xuaW1wb3J0IHsgZXh0ZW5kIH0gZnJvbSAnLi4vdXRpbCc7XG5pbXBvcnQgeyBlbnF1ZXVlUmVuZGVyIH0gZnJvbSAnLi4vcmVuZGVyLXF1ZXVlJztcbmltcG9ydCB7IGdldE5vZGVQcm9wcyB9IGZyb20gJy4vaW5kZXgnO1xuaW1wb3J0IHsgZGlmZiwgbW91bnRzLCBkaWZmTGV2ZWwsIGZsdXNoTW91bnRzLCByZWNvbGxlY3ROb2RlVHJlZSwgcmVtb3ZlQ2hpbGRyZW4gfSBmcm9tICcuL2RpZmYnO1xuaW1wb3J0IHsgY3JlYXRlQ29tcG9uZW50LCBjb2xsZWN0Q29tcG9uZW50IH0gZnJvbSAnLi9jb21wb25lbnQtcmVjeWNsZXInO1xuaW1wb3J0IHsgcmVtb3ZlTm9kZSB9IGZyb20gJy4uL2RvbSc7XG5cbi8qKiBTZXQgYSBjb21wb25lbnQncyBgcHJvcHNgIChnZW5lcmFsbHkgZGVyaXZlZCBmcm9tIEpTWCBhdHRyaWJ1dGVzKS5cbiAqXHRAcGFyYW0ge09iamVjdH0gcHJvcHNcbiAqXHRAcGFyYW0ge09iamVjdH0gW29wdHNdXG4gKlx0QHBhcmFtIHtib29sZWFufSBbb3B0cy5yZW5kZXJTeW5jPWZhbHNlXVx0SWYgYHRydWVgIGFuZCB7QGxpbmsgb3B0aW9ucy5zeW5jQ29tcG9uZW50VXBkYXRlc30gaXMgYHRydWVgLCB0cmlnZ2VycyBzeW5jaHJvbm91cyByZW5kZXJpbmcuXG4gKlx0QHBhcmFtIHtib29sZWFufSBbb3B0cy5yZW5kZXI9dHJ1ZV1cdFx0XHRJZiBgZmFsc2VgLCBubyByZW5kZXIgd2lsbCBiZSB0cmlnZ2VyZWQuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBzZXRDb21wb25lbnRQcm9wcyhjb21wb25lbnQsIHByb3BzLCBvcHRzLCBjb250ZXh0LCBtb3VudEFsbCkge1xuXHRpZiAoY29tcG9uZW50Ll9kaXNhYmxlKSByZXR1cm47XG5cdGNvbXBvbmVudC5fZGlzYWJsZSA9IHRydWU7XG5cblx0aWYgKChjb21wb25lbnQuX19yZWYgPSBwcm9wcy5yZWYpKSBkZWxldGUgcHJvcHMucmVmO1xuXHRpZiAoKGNvbXBvbmVudC5fX2tleSA9IHByb3BzLmtleSkpIGRlbGV0ZSBwcm9wcy5rZXk7XG5cblx0aWYgKCFjb21wb25lbnQuYmFzZSB8fCBtb3VudEFsbCkge1xuXHRcdGlmIChjb21wb25lbnQuY29tcG9uZW50V2lsbE1vdW50KSBjb21wb25lbnQuY29tcG9uZW50V2lsbE1vdW50KCk7XG5cdH1cblx0ZWxzZSBpZiAoY29tcG9uZW50LmNvbXBvbmVudFdpbGxSZWNlaXZlUHJvcHMpIHtcblx0XHRjb21wb25lbnQuY29tcG9uZW50V2lsbFJlY2VpdmVQcm9wcyhwcm9wcywgY29udGV4dCk7XG5cdH1cblxuXHRpZiAoY29udGV4dCAmJiBjb250ZXh0IT09Y29tcG9uZW50LmNvbnRleHQpIHtcblx0XHRpZiAoIWNvbXBvbmVudC5wcmV2Q29udGV4dCkgY29tcG9uZW50LnByZXZDb250ZXh0ID0gY29tcG9uZW50LmNvbnRleHQ7XG5cdFx0Y29tcG9uZW50LmNvbnRleHQgPSBjb250ZXh0O1xuXHR9XG5cblx0aWYgKCFjb21wb25lbnQucHJldlByb3BzKSBjb21wb25lbnQucHJldlByb3BzID0gY29tcG9uZW50LnByb3BzO1xuXHRjb21wb25lbnQucHJvcHMgPSBwcm9wcztcblxuXHRjb21wb25lbnQuX2Rpc2FibGUgPSBmYWxzZTtcblxuXHRpZiAob3B0cyE9PU5PX1JFTkRFUikge1xuXHRcdGlmIChvcHRzPT09U1lOQ19SRU5ERVIgfHwgb3B0aW9ucy5zeW5jQ29tcG9uZW50VXBkYXRlcyE9PWZhbHNlIHx8ICFjb21wb25lbnQuYmFzZSkge1xuXHRcdFx0cmVuZGVyQ29tcG9uZW50KGNvbXBvbmVudCwgU1lOQ19SRU5ERVIsIG1vdW50QWxsKTtcblx0XHR9XG5cdFx0ZWxzZSB7XG5cdFx0XHRlbnF1ZXVlUmVuZGVyKGNvbXBvbmVudCk7XG5cdFx0fVxuXHR9XG5cblx0aWYgKGNvbXBvbmVudC5fX3JlZikgY29tcG9uZW50Ll9fcmVmKGNvbXBvbmVudCk7XG59XG5cblxuXG4vKiogUmVuZGVyIGEgQ29tcG9uZW50LCB0cmlnZ2VyaW5nIG5lY2Vzc2FyeSBsaWZlY3ljbGUgZXZlbnRzIGFuZCB0YWtpbmcgSGlnaC1PcmRlciBDb21wb25lbnRzIGludG8gYWNjb3VudC5cbiAqXHRAcGFyYW0ge0NvbXBvbmVudH0gY29tcG9uZW50XG4gKlx0QHBhcmFtIHtPYmplY3R9IFtvcHRzXVxuICpcdEBwYXJhbSB7Ym9vbGVhbn0gW29wdHMuYnVpbGQ9ZmFsc2VdXHRcdElmIGB0cnVlYCwgY29tcG9uZW50IHdpbGwgYnVpbGQgYW5kIHN0b3JlIGEgRE9NIG5vZGUgaWYgbm90IGFscmVhZHkgYXNzb2NpYXRlZCB3aXRoIG9uZS5cbiAqXHRAcHJpdmF0ZVxuICovXG5leHBvcnQgZnVuY3Rpb24gcmVuZGVyQ29tcG9uZW50KGNvbXBvbmVudCwgb3B0cywgbW91bnRBbGwsIGlzQ2hpbGQpIHtcblx0aWYgKGNvbXBvbmVudC5fZGlzYWJsZSkgcmV0dXJuO1xuXG5cdGxldCBwcm9wcyA9IGNvbXBvbmVudC5wcm9wcyxcblx0XHRzdGF0ZSA9IGNvbXBvbmVudC5zdGF0ZSxcblx0XHRjb250ZXh0ID0gY29tcG9uZW50LmNvbnRleHQsXG5cdFx0cHJldmlvdXNQcm9wcyA9IGNvbXBvbmVudC5wcmV2UHJvcHMgfHwgcHJvcHMsXG5cdFx0cHJldmlvdXNTdGF0ZSA9IGNvbXBvbmVudC5wcmV2U3RhdGUgfHwgc3RhdGUsXG5cdFx0cHJldmlvdXNDb250ZXh0ID0gY29tcG9uZW50LnByZXZDb250ZXh0IHx8IGNvbnRleHQsXG5cdFx0aXNVcGRhdGUgPSBjb21wb25lbnQuYmFzZSxcblx0XHRuZXh0QmFzZSA9IGNvbXBvbmVudC5uZXh0QmFzZSxcblx0XHRpbml0aWFsQmFzZSA9IGlzVXBkYXRlIHx8IG5leHRCYXNlLFxuXHRcdGluaXRpYWxDaGlsZENvbXBvbmVudCA9IGNvbXBvbmVudC5fY29tcG9uZW50LFxuXHRcdHNraXAgPSBmYWxzZSxcblx0XHRyZW5kZXJlZCwgaW5zdCwgY2Jhc2U7XG5cblx0Ly8gaWYgdXBkYXRpbmdcblx0aWYgKGlzVXBkYXRlKSB7XG5cdFx0Y29tcG9uZW50LnByb3BzID0gcHJldmlvdXNQcm9wcztcblx0XHRjb21wb25lbnQuc3RhdGUgPSBwcmV2aW91c1N0YXRlO1xuXHRcdGNvbXBvbmVudC5jb250ZXh0ID0gcHJldmlvdXNDb250ZXh0O1xuXHRcdGlmIChvcHRzIT09Rk9SQ0VfUkVOREVSXG5cdFx0XHQmJiBjb21wb25lbnQuc2hvdWxkQ29tcG9uZW50VXBkYXRlXG5cdFx0XHQmJiBjb21wb25lbnQuc2hvdWxkQ29tcG9uZW50VXBkYXRlKHByb3BzLCBzdGF0ZSwgY29udGV4dCkgPT09IGZhbHNlKSB7XG5cdFx0XHRza2lwID0gdHJ1ZTtcblx0XHR9XG5cdFx0ZWxzZSBpZiAoY29tcG9uZW50LmNvbXBvbmVudFdpbGxVcGRhdGUpIHtcblx0XHRcdGNvbXBvbmVudC5jb21wb25lbnRXaWxsVXBkYXRlKHByb3BzLCBzdGF0ZSwgY29udGV4dCk7XG5cdFx0fVxuXHRcdGNvbXBvbmVudC5wcm9wcyA9IHByb3BzO1xuXHRcdGNvbXBvbmVudC5zdGF0ZSA9IHN0YXRlO1xuXHRcdGNvbXBvbmVudC5jb250ZXh0ID0gY29udGV4dDtcblx0fVxuXG5cdGNvbXBvbmVudC5wcmV2UHJvcHMgPSBjb21wb25lbnQucHJldlN0YXRlID0gY29tcG9uZW50LnByZXZDb250ZXh0ID0gY29tcG9uZW50Lm5leHRCYXNlID0gbnVsbDtcblx0Y29tcG9uZW50Ll9kaXJ0eSA9IGZhbHNlO1xuXG5cdGlmICghc2tpcCkge1xuXHRcdHJlbmRlcmVkID0gY29tcG9uZW50LnJlbmRlcihwcm9wcywgc3RhdGUsIGNvbnRleHQpO1xuXG5cdFx0Ly8gY29udGV4dCB0byBwYXNzIHRvIHRoZSBjaGlsZCwgY2FuIGJlIHVwZGF0ZWQgdmlhIChncmFuZC0pcGFyZW50IGNvbXBvbmVudFxuXHRcdGlmIChjb21wb25lbnQuZ2V0Q2hpbGRDb250ZXh0KSB7XG5cdFx0XHRjb250ZXh0ID0gZXh0ZW5kKGV4dGVuZCh7fSwgY29udGV4dCksIGNvbXBvbmVudC5nZXRDaGlsZENvbnRleHQoKSk7XG5cdFx0fVxuXG5cdFx0bGV0IGNoaWxkQ29tcG9uZW50ID0gcmVuZGVyZWQgJiYgcmVuZGVyZWQubm9kZU5hbWUsXG5cdFx0XHR0b1VubW91bnQsIGJhc2U7XG5cblx0XHRpZiAodHlwZW9mIGNoaWxkQ29tcG9uZW50PT09J2Z1bmN0aW9uJykge1xuXHRcdFx0Ly8gc2V0IHVwIGhpZ2ggb3JkZXIgY29tcG9uZW50IGxpbmtcblxuXHRcdFx0bGV0IGNoaWxkUHJvcHMgPSBnZXROb2RlUHJvcHMocmVuZGVyZWQpO1xuXHRcdFx0aW5zdCA9IGluaXRpYWxDaGlsZENvbXBvbmVudDtcblxuXHRcdFx0aWYgKGluc3QgJiYgaW5zdC5jb25zdHJ1Y3Rvcj09PWNoaWxkQ29tcG9uZW50ICYmIGNoaWxkUHJvcHMua2V5PT1pbnN0Ll9fa2V5KSB7XG5cdFx0XHRcdHNldENvbXBvbmVudFByb3BzKGluc3QsIGNoaWxkUHJvcHMsIFNZTkNfUkVOREVSLCBjb250ZXh0LCBmYWxzZSk7XG5cdFx0XHR9XG5cdFx0XHRlbHNlIHtcblx0XHRcdFx0dG9Vbm1vdW50ID0gaW5zdDtcblxuXHRcdFx0XHRjb21wb25lbnQuX2NvbXBvbmVudCA9IGluc3QgPSBjcmVhdGVDb21wb25lbnQoY2hpbGRDb21wb25lbnQsIGNoaWxkUHJvcHMsIGNvbnRleHQpO1xuXHRcdFx0XHRpbnN0Lm5leHRCYXNlID0gaW5zdC5uZXh0QmFzZSB8fCBuZXh0QmFzZTtcblx0XHRcdFx0aW5zdC5fcGFyZW50Q29tcG9uZW50ID0gY29tcG9uZW50O1xuXHRcdFx0XHRzZXRDb21wb25lbnRQcm9wcyhpbnN0LCBjaGlsZFByb3BzLCBOT19SRU5ERVIsIGNvbnRleHQsIGZhbHNlKTtcblx0XHRcdFx0cmVuZGVyQ29tcG9uZW50KGluc3QsIFNZTkNfUkVOREVSLCBtb3VudEFsbCwgdHJ1ZSk7XG5cdFx0XHR9XG5cblx0XHRcdGJhc2UgPSBpbnN0LmJhc2U7XG5cdFx0fVxuXHRcdGVsc2Uge1xuXHRcdFx0Y2Jhc2UgPSBpbml0aWFsQmFzZTtcblxuXHRcdFx0Ly8gZGVzdHJveSBoaWdoIG9yZGVyIGNvbXBvbmVudCBsaW5rXG5cdFx0XHR0b1VubW91bnQgPSBpbml0aWFsQ2hpbGRDb21wb25lbnQ7XG5cdFx0XHRpZiAodG9Vbm1vdW50KSB7XG5cdFx0XHRcdGNiYXNlID0gY29tcG9uZW50Ll9jb21wb25lbnQgPSBudWxsO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAoaW5pdGlhbEJhc2UgfHwgb3B0cz09PVNZTkNfUkVOREVSKSB7XG5cdFx0XHRcdGlmIChjYmFzZSkgY2Jhc2UuX2NvbXBvbmVudCA9IG51bGw7XG5cdFx0XHRcdGJhc2UgPSBkaWZmKGNiYXNlLCByZW5kZXJlZCwgY29udGV4dCwgbW91bnRBbGwgfHwgIWlzVXBkYXRlLCBpbml0aWFsQmFzZSAmJiBpbml0aWFsQmFzZS5wYXJlbnROb2RlLCB0cnVlKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRpZiAoaW5pdGlhbEJhc2UgJiYgYmFzZSE9PWluaXRpYWxCYXNlICYmIGluc3QhPT1pbml0aWFsQ2hpbGRDb21wb25lbnQpIHtcblx0XHRcdGxldCBiYXNlUGFyZW50ID0gaW5pdGlhbEJhc2UucGFyZW50Tm9kZTtcblx0XHRcdGlmIChiYXNlUGFyZW50ICYmIGJhc2UhPT1iYXNlUGFyZW50KSB7XG5cdFx0XHRcdGJhc2VQYXJlbnQucmVwbGFjZUNoaWxkKGJhc2UsIGluaXRpYWxCYXNlKTtcblxuXHRcdFx0XHRpZiAoIXRvVW5tb3VudCkge1xuXHRcdFx0XHRcdGluaXRpYWxCYXNlLl9jb21wb25lbnQgPSBudWxsO1xuXHRcdFx0XHRcdHJlY29sbGVjdE5vZGVUcmVlKGluaXRpYWxCYXNlLCBmYWxzZSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cblx0XHRpZiAodG9Vbm1vdW50KSB7XG5cdFx0XHR1bm1vdW50Q29tcG9uZW50KHRvVW5tb3VudCk7XG5cdFx0fVxuXG5cdFx0Y29tcG9uZW50LmJhc2UgPSBiYXNlO1xuXHRcdGlmIChiYXNlICYmICFpc0NoaWxkKSB7XG5cdFx0XHRsZXQgY29tcG9uZW50UmVmID0gY29tcG9uZW50LFxuXHRcdFx0XHR0ID0gY29tcG9uZW50O1xuXHRcdFx0d2hpbGUgKCh0PXQuX3BhcmVudENvbXBvbmVudCkpIHtcblx0XHRcdFx0KGNvbXBvbmVudFJlZiA9IHQpLmJhc2UgPSBiYXNlO1xuXHRcdFx0fVxuXHRcdFx0YmFzZS5fY29tcG9uZW50ID0gY29tcG9uZW50UmVmO1xuXHRcdFx0YmFzZS5fY29tcG9uZW50Q29uc3RydWN0b3IgPSBjb21wb25lbnRSZWYuY29uc3RydWN0b3I7XG5cdFx0fVxuXHR9XG5cblx0aWYgKCFpc1VwZGF0ZSB8fCBtb3VudEFsbCkge1xuXHRcdG1vdW50cy51bnNoaWZ0KGNvbXBvbmVudCk7XG5cdH1cblx0ZWxzZSBpZiAoIXNraXApIHtcblx0XHQvLyBFbnN1cmUgdGhhdCBwZW5kaW5nIGNvbXBvbmVudERpZE1vdW50KCkgaG9va3Mgb2YgY2hpbGQgY29tcG9uZW50c1xuXHRcdC8vIGFyZSBjYWxsZWQgYmVmb3JlIHRoZSBjb21wb25lbnREaWRVcGRhdGUoKSBob29rIGluIHRoZSBwYXJlbnQuXG5cdFx0Zmx1c2hNb3VudHMoKTtcblxuXHRcdGlmIChjb21wb25lbnQuY29tcG9uZW50RGlkVXBkYXRlKSB7XG5cdFx0XHRjb21wb25lbnQuY29tcG9uZW50RGlkVXBkYXRlKHByZXZpb3VzUHJvcHMsIHByZXZpb3VzU3RhdGUsIHByZXZpb3VzQ29udGV4dCk7XG5cdFx0fVxuXHRcdGlmIChvcHRpb25zLmFmdGVyVXBkYXRlKSBvcHRpb25zLmFmdGVyVXBkYXRlKGNvbXBvbmVudCk7XG5cdH1cblxuXHRpZiAoY29tcG9uZW50Ll9yZW5kZXJDYWxsYmFja3MhPW51bGwpIHtcblx0XHR3aGlsZSAoY29tcG9uZW50Ll9yZW5kZXJDYWxsYmFja3MubGVuZ3RoKSBjb21wb25lbnQuX3JlbmRlckNhbGxiYWNrcy5wb3AoKS5jYWxsKGNvbXBvbmVudCk7XG5cdH1cblxuXHRpZiAoIWRpZmZMZXZlbCAmJiAhaXNDaGlsZCkgZmx1c2hNb3VudHMoKTtcbn1cblxuXG5cbi8qKiBBcHBseSB0aGUgQ29tcG9uZW50IHJlZmVyZW5jZWQgYnkgYSBWTm9kZSB0byB0aGUgRE9NLlxuICpcdEBwYXJhbSB7RWxlbWVudH0gZG9tXHRUaGUgRE9NIG5vZGUgdG8gbXV0YXRlXG4gKlx0QHBhcmFtIHtWTm9kZX0gdm5vZGVcdEEgQ29tcG9uZW50LXJlZmVyZW5jaW5nIFZOb2RlXG4gKlx0QHJldHVybnMge0VsZW1lbnR9IGRvbVx0VGhlIGNyZWF0ZWQvbXV0YXRlZCBlbGVtZW50XG4gKlx0QHByaXZhdGVcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGJ1aWxkQ29tcG9uZW50RnJvbVZOb2RlKGRvbSwgdm5vZGUsIGNvbnRleHQsIG1vdW50QWxsKSB7XG5cdGxldCBjID0gZG9tICYmIGRvbS5fY29tcG9uZW50LFxuXHRcdG9yaWdpbmFsQ29tcG9uZW50ID0gYyxcblx0XHRvbGREb20gPSBkb20sXG5cdFx0aXNEaXJlY3RPd25lciA9IGMgJiYgZG9tLl9jb21wb25lbnRDb25zdHJ1Y3Rvcj09PXZub2RlLm5vZGVOYW1lLFxuXHRcdGlzT3duZXIgPSBpc0RpcmVjdE93bmVyLFxuXHRcdHByb3BzID0gZ2V0Tm9kZVByb3BzKHZub2RlKTtcblx0d2hpbGUgKGMgJiYgIWlzT3duZXIgJiYgKGM9Yy5fcGFyZW50Q29tcG9uZW50KSkge1xuXHRcdGlzT3duZXIgPSBjLmNvbnN0cnVjdG9yPT09dm5vZGUubm9kZU5hbWU7XG5cdH1cblxuXHRpZiAoYyAmJiBpc093bmVyICYmICghbW91bnRBbGwgfHwgYy5fY29tcG9uZW50KSkge1xuXHRcdHNldENvbXBvbmVudFByb3BzKGMsIHByb3BzLCBBU1lOQ19SRU5ERVIsIGNvbnRleHQsIG1vdW50QWxsKTtcblx0XHRkb20gPSBjLmJhc2U7XG5cdH1cblx0ZWxzZSB7XG5cdFx0aWYgKG9yaWdpbmFsQ29tcG9uZW50ICYmICFpc0RpcmVjdE93bmVyKSB7XG5cdFx0XHR1bm1vdW50Q29tcG9uZW50KG9yaWdpbmFsQ29tcG9uZW50KTtcblx0XHRcdGRvbSA9IG9sZERvbSA9IG51bGw7XG5cdFx0fVxuXG5cdFx0YyA9IGNyZWF0ZUNvbXBvbmVudCh2bm9kZS5ub2RlTmFtZSwgcHJvcHMsIGNvbnRleHQpO1xuXHRcdGlmIChkb20gJiYgIWMubmV4dEJhc2UpIHtcblx0XHRcdGMubmV4dEJhc2UgPSBkb207XG5cdFx0XHQvLyBwYXNzaW5nIGRvbS9vbGREb20gYXMgbmV4dEJhc2Ugd2lsbCByZWN5Y2xlIGl0IGlmIHVudXNlZCwgc28gYnlwYXNzIHJlY3ljbGluZyBvbiBMMjI5OlxuXHRcdFx0b2xkRG9tID0gbnVsbDtcblx0XHR9XG5cdFx0c2V0Q29tcG9uZW50UHJvcHMoYywgcHJvcHMsIFNZTkNfUkVOREVSLCBjb250ZXh0LCBtb3VudEFsbCk7XG5cdFx0ZG9tID0gYy5iYXNlO1xuXG5cdFx0aWYgKG9sZERvbSAmJiBkb20hPT1vbGREb20pIHtcblx0XHRcdG9sZERvbS5fY29tcG9uZW50ID0gbnVsbDtcblx0XHRcdHJlY29sbGVjdE5vZGVUcmVlKG9sZERvbSwgZmFsc2UpO1xuXHRcdH1cblx0fVxuXG5cdHJldHVybiBkb207XG59XG5cblxuXG4vKiogUmVtb3ZlIGEgY29tcG9uZW50IGZyb20gdGhlIERPTSBhbmQgcmVjeWNsZSBpdC5cbiAqXHRAcGFyYW0ge0NvbXBvbmVudH0gY29tcG9uZW50XHRUaGUgQ29tcG9uZW50IGluc3RhbmNlIHRvIHVubW91bnRcbiAqXHRAcHJpdmF0ZVxuICovXG5leHBvcnQgZnVuY3Rpb24gdW5tb3VudENvbXBvbmVudChjb21wb25lbnQpIHtcblx0aWYgKG9wdGlvbnMuYmVmb3JlVW5tb3VudCkgb3B0aW9ucy5iZWZvcmVVbm1vdW50KGNvbXBvbmVudCk7XG5cblx0bGV0IGJhc2UgPSBjb21wb25lbnQuYmFzZTtcblxuXHRjb21wb25lbnQuX2Rpc2FibGUgPSB0cnVlO1xuXG5cdGlmIChjb21wb25lbnQuY29tcG9uZW50V2lsbFVubW91bnQpIGNvbXBvbmVudC5jb21wb25lbnRXaWxsVW5tb3VudCgpO1xuXG5cdGNvbXBvbmVudC5iYXNlID0gbnVsbDtcblxuXHQvLyByZWN1cnNpdmVseSB0ZWFyIGRvd24gJiByZWNvbGxlY3QgaGlnaC1vcmRlciBjb21wb25lbnQgY2hpbGRyZW46XG5cdGxldCBpbm5lciA9IGNvbXBvbmVudC5fY29tcG9uZW50O1xuXHRpZiAoaW5uZXIpIHtcblx0XHR1bm1vdW50Q29tcG9uZW50KGlubmVyKTtcblx0fVxuXHRlbHNlIGlmIChiYXNlKSB7XG5cdFx0aWYgKGJhc2VbQVRUUl9LRVldICYmIGJhc2VbQVRUUl9LRVldLnJlZikgYmFzZVtBVFRSX0tFWV0ucmVmKG51bGwpO1xuXG5cdFx0Y29tcG9uZW50Lm5leHRCYXNlID0gYmFzZTtcblxuXHRcdHJlbW92ZU5vZGUoYmFzZSk7XG5cdFx0Y29sbGVjdENvbXBvbmVudChjb21wb25lbnQpO1xuXG5cdFx0cmVtb3ZlQ2hpbGRyZW4oYmFzZSk7XG5cdH1cblxuXHRpZiAoY29tcG9uZW50Ll9fcmVmKSBjb21wb25lbnQuX19yZWYobnVsbCk7XG59XG4iLCJpbXBvcnQgeyBGT1JDRV9SRU5ERVIgfSBmcm9tICcuL2NvbnN0YW50cyc7XG5pbXBvcnQgeyBleHRlbmQgfSBmcm9tICcuL3V0aWwnO1xuaW1wb3J0IHsgcmVuZGVyQ29tcG9uZW50IH0gZnJvbSAnLi92ZG9tL2NvbXBvbmVudCc7XG5pbXBvcnQgeyBlbnF1ZXVlUmVuZGVyIH0gZnJvbSAnLi9yZW5kZXItcXVldWUnO1xuXG4vKiogQmFzZSBDb21wb25lbnQgY2xhc3MuXG4gKlx0UHJvdmlkZXMgYHNldFN0YXRlKClgIGFuZCBgZm9yY2VVcGRhdGUoKWAsIHdoaWNoIHRyaWdnZXIgcmVuZGVyaW5nLlxuICpcdEBwdWJsaWNcbiAqXG4gKlx0QGV4YW1wbGVcbiAqXHRjbGFzcyBNeUZvbyBleHRlbmRzIENvbXBvbmVudCB7XG4gKlx0XHRyZW5kZXIocHJvcHMsIHN0YXRlKSB7XG4gKlx0XHRcdHJldHVybiA8ZGl2IC8+O1xuICpcdFx0fVxuICpcdH1cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIENvbXBvbmVudChwcm9wcywgY29udGV4dCkge1xuXHR0aGlzLl9kaXJ0eSA9IHRydWU7XG5cblx0LyoqIEBwdWJsaWNcblx0ICpcdEB0eXBlIHtvYmplY3R9XG5cdCAqL1xuXHR0aGlzLmNvbnRleHQgPSBjb250ZXh0O1xuXG5cdC8qKiBAcHVibGljXG5cdCAqXHRAdHlwZSB7b2JqZWN0fVxuXHQgKi9cblx0dGhpcy5wcm9wcyA9IHByb3BzO1xuXG5cdC8qKiBAcHVibGljXG5cdCAqXHRAdHlwZSB7b2JqZWN0fVxuXHQgKi9cblx0dGhpcy5zdGF0ZSA9IHRoaXMuc3RhdGUgfHwge307XG59XG5cblxuZXh0ZW5kKENvbXBvbmVudC5wcm90b3R5cGUsIHtcblxuXHQvKiogUmV0dXJucyBhIGBib29sZWFuYCBpbmRpY2F0aW5nIGlmIHRoZSBjb21wb25lbnQgc2hvdWxkIHJlLXJlbmRlciB3aGVuIHJlY2VpdmluZyB0aGUgZ2l2ZW4gYHByb3BzYCBhbmQgYHN0YXRlYC5cblx0ICpcdEBwYXJhbSB7b2JqZWN0fSBuZXh0UHJvcHNcblx0ICpcdEBwYXJhbSB7b2JqZWN0fSBuZXh0U3RhdGVcblx0ICpcdEBwYXJhbSB7b2JqZWN0fSBuZXh0Q29udGV4dFxuXHQgKlx0QHJldHVybnMge0Jvb2xlYW59IHNob3VsZCB0aGUgY29tcG9uZW50IHJlLXJlbmRlclxuXHQgKlx0QG5hbWUgc2hvdWxkQ29tcG9uZW50VXBkYXRlXG5cdCAqXHRAZnVuY3Rpb25cblx0ICovXG5cblxuXHQvKiogVXBkYXRlIGNvbXBvbmVudCBzdGF0ZSBieSBjb3B5aW5nIHByb3BlcnRpZXMgZnJvbSBgc3RhdGVgIHRvIGB0aGlzLnN0YXRlYC5cblx0ICpcdEBwYXJhbSB7b2JqZWN0fSBzdGF0ZVx0XHRBIGhhc2ggb2Ygc3RhdGUgcHJvcGVydGllcyB0byB1cGRhdGUgd2l0aCBuZXcgdmFsdWVzXG5cdCAqXHRAcGFyYW0ge2Z1bmN0aW9ufSBjYWxsYmFja1x0QSBmdW5jdGlvbiB0byBiZSBjYWxsZWQgb25jZSBjb21wb25lbnQgc3RhdGUgaXMgdXBkYXRlZFxuXHQgKi9cblx0c2V0U3RhdGUoc3RhdGUsIGNhbGxiYWNrKSB7XG5cdFx0bGV0IHMgPSB0aGlzLnN0YXRlO1xuXHRcdGlmICghdGhpcy5wcmV2U3RhdGUpIHRoaXMucHJldlN0YXRlID0gZXh0ZW5kKHt9LCBzKTtcblx0XHRleHRlbmQocywgdHlwZW9mIHN0YXRlPT09J2Z1bmN0aW9uJyA/IHN0YXRlKHMsIHRoaXMucHJvcHMpIDogc3RhdGUpO1xuXHRcdGlmIChjYWxsYmFjaykgKHRoaXMuX3JlbmRlckNhbGxiYWNrcyA9ICh0aGlzLl9yZW5kZXJDYWxsYmFja3MgfHwgW10pKS5wdXNoKGNhbGxiYWNrKTtcblx0XHRlbnF1ZXVlUmVuZGVyKHRoaXMpO1xuXHR9LFxuXG5cblx0LyoqIEltbWVkaWF0ZWx5IHBlcmZvcm0gYSBzeW5jaHJvbm91cyByZS1yZW5kZXIgb2YgdGhlIGNvbXBvbmVudC5cblx0ICpcdEBwYXJhbSB7ZnVuY3Rpb259IGNhbGxiYWNrXHRcdEEgZnVuY3Rpb24gdG8gYmUgY2FsbGVkIGFmdGVyIGNvbXBvbmVudCBpcyByZS1yZW5kZXJlZC5cblx0ICpcdEBwcml2YXRlXG5cdCAqL1xuXHRmb3JjZVVwZGF0ZShjYWxsYmFjaykge1xuXHRcdGlmIChjYWxsYmFjaykgKHRoaXMuX3JlbmRlckNhbGxiYWNrcyA9ICh0aGlzLl9yZW5kZXJDYWxsYmFja3MgfHwgW10pKS5wdXNoKGNhbGxiYWNrKTtcblx0XHRyZW5kZXJDb21wb25lbnQodGhpcywgRk9SQ0VfUkVOREVSKTtcblx0fSxcblxuXG5cdC8qKiBBY2NlcHRzIGBwcm9wc2AgYW5kIGBzdGF0ZWAsIGFuZCByZXR1cm5zIGEgbmV3IFZpcnR1YWwgRE9NIHRyZWUgdG8gYnVpbGQuXG5cdCAqXHRWaXJ0dWFsIERPTSBpcyBnZW5lcmFsbHkgY29uc3RydWN0ZWQgdmlhIFtKU1hdKGh0dHA6Ly9qYXNvbmZvcm1hdC5jb20vd3RmLWlzLWpzeCkuXG5cdCAqXHRAcGFyYW0ge29iamVjdH0gcHJvcHNcdFx0UHJvcHMgKGVnOiBKU1ggYXR0cmlidXRlcykgcmVjZWl2ZWQgZnJvbSBwYXJlbnQgZWxlbWVudC9jb21wb25lbnRcblx0ICpcdEBwYXJhbSB7b2JqZWN0fSBzdGF0ZVx0XHRUaGUgY29tcG9uZW50J3MgY3VycmVudCBzdGF0ZVxuXHQgKlx0QHBhcmFtIHtvYmplY3R9IGNvbnRleHRcdFx0Q29udGV4dCBvYmplY3QgKGlmIGEgcGFyZW50IGNvbXBvbmVudCBoYXMgcHJvdmlkZWQgY29udGV4dClcblx0ICpcdEByZXR1cm5zIFZOb2RlXG5cdCAqL1xuXHRyZW5kZXIoKSB7fVxuXG59KTtcbiIsImltcG9ydCB7IGRpZmYgfSBmcm9tICcuL3Zkb20vZGlmZic7XG5cbi8qKiBSZW5kZXIgSlNYIGludG8gYSBgcGFyZW50YCBFbGVtZW50LlxuICpcdEBwYXJhbSB7Vk5vZGV9IHZub2RlXHRcdEEgKEpTWCkgVk5vZGUgdG8gcmVuZGVyXG4gKlx0QHBhcmFtIHtFbGVtZW50fSBwYXJlbnRcdFx0RE9NIGVsZW1lbnQgdG8gcmVuZGVyIGludG9cbiAqXHRAcGFyYW0ge0VsZW1lbnR9IFttZXJnZV1cdEF0dGVtcHQgdG8gcmUtdXNlIGFuIGV4aXN0aW5nIERPTSB0cmVlIHJvb3RlZCBhdCBgbWVyZ2VgXG4gKlx0QHB1YmxpY1xuICpcbiAqXHRAZXhhbXBsZVxuICpcdC8vIHJlbmRlciBhIGRpdiBpbnRvIDxib2R5PjpcbiAqXHRyZW5kZXIoPGRpdiBpZD1cImhlbGxvXCI+aGVsbG8hPC9kaXY+LCBkb2N1bWVudC5ib2R5KTtcbiAqXG4gKlx0QGV4YW1wbGVcbiAqXHQvLyByZW5kZXIgYSBcIlRoaW5nXCIgY29tcG9uZW50IGludG8gI2ZvbzpcbiAqXHRjb25zdCBUaGluZyA9ICh7IG5hbWUgfSkgPT4gPHNwYW4+eyBuYW1lIH08L3NwYW4+O1xuICpcdHJlbmRlcig8VGhpbmcgbmFtZT1cIm9uZVwiIC8+LCBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcjZm9vJykpO1xuICovXG5leHBvcnQgZnVuY3Rpb24gcmVuZGVyKHZub2RlLCBwYXJlbnQsIG1lcmdlKSB7XG5cdHJldHVybiBkaWZmKG1lcmdlLCB2bm9kZSwge30sIGZhbHNlLCBwYXJlbnQsIGZhbHNlKTtcbn1cbiIsIi8qKiBWaXJ0dWFsIERPTSBOb2RlICovXG5leHBvcnQgZnVuY3Rpb24gVk5vZGUobm9kZU5hbWUsIGF0dHJpYnV0ZXMsIGNoaWxkcmVuKSB7XG5cdC8qKiBAdHlwZSB7c3RyaW5nfGZ1bmN0aW9ufSAqL1xuXHR0aGlzLm5vZGVOYW1lID0gbm9kZU5hbWU7XG5cblx0LyoqIEB0eXBlIHtvYmplY3Q8c3RyaW5nPnx1bmRlZmluZWR9ICovXG5cdHRoaXMuYXR0cmlidXRlcyA9IGF0dHJpYnV0ZXM7XG5cblx0LyoqIEB0eXBlIHthcnJheTxWTm9kZT58dW5kZWZpbmVkfSAqL1xuXHR0aGlzLmNoaWxkcmVuID0gY2hpbGRyZW47XG5cblx0LyoqIFJlZmVyZW5jZSB0byB0aGUgZ2l2ZW4ga2V5LiAqL1xuXHR0aGlzLmtleSA9IGF0dHJpYnV0ZXMgJiYgYXR0cmlidXRlcy5rZXk7XG59XG4iLCIvKiogR2xvYmFsIG9wdGlvbnNcbiAqXHRAcHVibGljXG4gKlx0QG5hbWVzcGFjZSBvcHRpb25zIHtPYmplY3R9XG4gKi9cbmV4cG9ydCBkZWZhdWx0IHtcblxuXHQvKiogSWYgYHRydWVgLCBgcHJvcGAgY2hhbmdlcyB0cmlnZ2VyIHN5bmNocm9ub3VzIGNvbXBvbmVudCB1cGRhdGVzLlxuXHQgKlx0QG5hbWUgc3luY0NvbXBvbmVudFVwZGF0ZXNcblx0ICpcdEB0eXBlIEJvb2xlYW5cblx0ICpcdEBkZWZhdWx0IHRydWVcblx0ICovXG5cdC8vc3luY0NvbXBvbmVudFVwZGF0ZXM6IHRydWUsXG5cblx0LyoqIFByb2Nlc3NlcyBhbGwgY3JlYXRlZCBWTm9kZXMuXG5cdCAqXHRAcGFyYW0ge1ZOb2RlfSB2bm9kZVx0QSBuZXdseS1jcmVhdGVkIFZOb2RlIHRvIG5vcm1hbGl6ZS9wcm9jZXNzXG5cdCAqL1xuXHQvL3Zub2RlKHZub2RlKSB7IH1cblxuXHQvKiogSG9vayBpbnZva2VkIGFmdGVyIGEgY29tcG9uZW50IGlzIG1vdW50ZWQuICovXG5cdC8vIGFmdGVyTW91bnQoY29tcG9uZW50KSB7IH1cblxuXHQvKiogSG9vayBpbnZva2VkIGFmdGVyIHRoZSBET00gaXMgdXBkYXRlZCB3aXRoIGEgY29tcG9uZW50J3MgbGF0ZXN0IHJlbmRlci4gKi9cblx0Ly8gYWZ0ZXJVcGRhdGUoY29tcG9uZW50KSB7IH1cblxuXHQvKiogSG9vayBpbnZva2VkIGltbWVkaWF0ZWx5IGJlZm9yZSBhIGNvbXBvbmVudCBpcyB1bm1vdW50ZWQuICovXG5cdC8vIGJlZm9yZVVubW91bnQoY29tcG9uZW50KSB7IH1cbn07XG4iLCJpbXBvcnQgeyBWTm9kZSB9IGZyb20gJy4vdm5vZGUnO1xuaW1wb3J0IG9wdGlvbnMgZnJvbSAnLi9vcHRpb25zJztcblxuXG5jb25zdCBzdGFjayA9IFtdO1xuXG5cbi8qKiBKU1gvaHlwZXJzY3JpcHQgcmV2aXZlclxuKlx0QmVuY2htYXJrczogaHR0cHM6Ly9lc2JlbmNoLmNvbS9iZW5jaC81N2VlOGY4ZTMzMGFiMDk5MDBhMWExYTBcbiAqXHRAc2VlIGh0dHA6Ly9qYXNvbmZvcm1hdC5jb20vd3RmLWlzLWpzeFxuICpcdEBwdWJsaWNcbiAqICBAZXhhbXBsZVxuICogIC8qKiBAanN4IGggKlxcL1xuICogIGltcG9ydCB7IHJlbmRlciwgaCB9IGZyb20gJ3ByZWFjdCc7XG4gKiAgcmVuZGVyKDxzcGFuPmZvbzwvc3Bhbj4sIGRvY3VtZW50LmJvZHkpO1xuICovXG5leHBvcnQgZnVuY3Rpb24gaChub2RlTmFtZSwgYXR0cmlidXRlcykge1xuXHRsZXQgY2hpbGRyZW4gPSBbXSxcblx0XHRsYXN0U2ltcGxlLCBjaGlsZCwgc2ltcGxlLCBpO1xuXHRmb3IgKGk9YXJndW1lbnRzLmxlbmd0aDsgaS0tID4gMjsgKSB7XG5cdFx0c3RhY2sucHVzaChhcmd1bWVudHNbaV0pO1xuXHR9XG5cdGlmIChhdHRyaWJ1dGVzICYmIGF0dHJpYnV0ZXMuY2hpbGRyZW4pIHtcblx0XHRpZiAoIXN0YWNrLmxlbmd0aCkgc3RhY2sucHVzaChhdHRyaWJ1dGVzLmNoaWxkcmVuKTtcblx0XHRkZWxldGUgYXR0cmlidXRlcy5jaGlsZHJlbjtcblx0fVxuXHR3aGlsZSAoc3RhY2subGVuZ3RoKSB7XG5cdFx0aWYgKChjaGlsZCA9IHN0YWNrLnBvcCgpKSBpbnN0YW5jZW9mIEFycmF5KSB7XG5cdFx0XHRmb3IgKGk9Y2hpbGQubGVuZ3RoOyBpLS07ICkgc3RhY2sucHVzaChjaGlsZFtpXSk7XG5cdFx0fVxuXHRcdGVsc2UgaWYgKGNoaWxkIT1udWxsICYmIGNoaWxkIT09ZmFsc2UpIHtcblx0XHRcdGlmICh0eXBlb2YgY2hpbGQ9PSdudW1iZXInIHx8IGNoaWxkPT09dHJ1ZSkgY2hpbGQgPSBTdHJpbmcoY2hpbGQpO1xuXHRcdFx0c2ltcGxlID0gdHlwZW9mIGNoaWxkPT0nc3RyaW5nJztcblx0XHRcdGlmIChzaW1wbGUgJiYgbGFzdFNpbXBsZSkge1xuXHRcdFx0XHRjaGlsZHJlbltjaGlsZHJlbi5sZW5ndGgtMV0gKz0gY2hpbGQ7XG5cdFx0XHR9XG5cdFx0XHRlbHNlIHtcblx0XHRcdFx0Y2hpbGRyZW4ucHVzaChjaGlsZCk7XG5cdFx0XHRcdGxhc3RTaW1wbGUgPSBzaW1wbGU7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0bGV0IHAgPSBuZXcgVk5vZGUobm9kZU5hbWUsIGF0dHJpYnV0ZXMgfHwgdW5kZWZpbmVkLCBjaGlsZHJlbik7XG5cblx0Ly8gaWYgYSBcInZub2RlIGhvb2tcIiBpcyBkZWZpbmVkLCBwYXNzIGV2ZXJ5IGNyZWF0ZWQgVk5vZGUgdG8gaXRcblx0aWYgKG9wdGlvbnMudm5vZGUpIG9wdGlvbnMudm5vZGUocCk7XG5cblx0cmV0dXJuIHA7XG59XG4iLCIvKiogQ29weSBvd24tcHJvcGVydGllcyBmcm9tIGBwcm9wc2Agb250byBgb2JqYC5cbiAqXHRAcmV0dXJucyBvYmpcbiAqXHRAcHJpdmF0ZVxuICovXG5leHBvcnQgZnVuY3Rpb24gZXh0ZW5kKG9iaiwgcHJvcHMpIHtcblx0aWYgKHByb3BzKSB7XG5cdFx0Zm9yIChsZXQgaSBpbiBwcm9wcykgb2JqW2ldID0gcHJvcHNbaV07XG5cdH1cblx0cmV0dXJuIG9iajtcbn1cblxuXG4vKiogRmFzdCBjbG9uZS4gTm90ZTogZG9lcyBub3QgZmlsdGVyIG91dCBub24tb3duIHByb3BlcnRpZXMuXG4gKlx0QHNlZSBodHRwczovL2VzYmVuY2guY29tL2JlbmNoLzU2YmFhMzRmNDVkZjY4OTUwMDJlMDNiNlxuICovXG5leHBvcnQgZnVuY3Rpb24gY2xvbmUob2JqKSB7XG5cdHJldHVybiBleHRlbmQoe30sIG9iaik7XG59XG5cblxuLyoqIEdldCBhIGRlZXAgcHJvcGVydHkgdmFsdWUgZnJvbSB0aGUgZ2l2ZW4gb2JqZWN0LCBleHByZXNzZWQgaW4gZG90LW5vdGF0aW9uLlxuICpcdEBwcml2YXRlXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBkZWx2ZShvYmosIGtleSkge1xuXHRmb3IgKGxldCBwPWtleS5zcGxpdCgnLicpLCBpPTA7IGk8cC5sZW5ndGggJiYgb2JqOyBpKyspIHtcblx0XHRvYmogPSBvYmpbcFtpXV07XG5cdH1cblx0cmV0dXJuIG9iajtcbn1cblxuXG4vKiogQHByaXZhdGUgaXMgdGhlIGdpdmVuIG9iamVjdCBhIEZ1bmN0aW9uPyAqL1xuZXhwb3J0IGZ1bmN0aW9uIGlzRnVuY3Rpb24ob2JqKSB7XG5cdHJldHVybiAnZnVuY3Rpb24nPT09dHlwZW9mIG9iajtcbn1cblxuXG4vKiogQHByaXZhdGUgaXMgdGhlIGdpdmVuIG9iamVjdCBhIFN0cmluZz8gKi9cbmV4cG9ydCBmdW5jdGlvbiBpc1N0cmluZyhvYmopIHtcblx0cmV0dXJuICdzdHJpbmcnPT09dHlwZW9mIG9iajtcbn1cblxuXG4vKiogQ29udmVydCBhIGhhc2htYXAgb2YgQ1NTIGNsYXNzZXMgdG8gYSBzcGFjZS1kZWxpbWl0ZWQgY2xhc3NOYW1lIHN0cmluZ1xuICpcdEBwcml2YXRlXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBoYXNoVG9DbGFzc05hbWUoYykge1xuXHRsZXQgc3RyID0gJyc7XG5cdGZvciAobGV0IHByb3AgaW4gYykge1xuXHRcdGlmIChjW3Byb3BdKSB7XG5cdFx0XHRpZiAoc3RyKSBzdHIgKz0gJyAnO1xuXHRcdFx0c3RyICs9IHByb3A7XG5cdFx0fVxuXHR9XG5cdHJldHVybiBzdHI7XG59XG5cblxuLyoqIEp1c3QgYSBtZW1vaXplZCBTdHJpbmcjdG9Mb3dlckNhc2UgKi9cbmxldCBsY0NhY2hlID0ge307XG5leHBvcnQgY29uc3QgdG9Mb3dlckNhc2UgPSBzID0+IGxjQ2FjaGVbc10gfHwgKGxjQ2FjaGVbc10gPSBzLnRvTG93ZXJDYXNlKCkpO1xuXG5cbi8qKiBDYWxsIGEgZnVuY3Rpb24gYXN5bmNocm9ub3VzbHksIGFzIHNvb24gYXMgcG9zc2libGUuXG4gKlx0QHBhcmFtIHtGdW5jdGlvbn0gY2FsbGJhY2tcbiAqL1xubGV0IHJlc29sdmVkID0gdHlwZW9mIFByb21pc2UhPT0ndW5kZWZpbmVkJyAmJiBQcm9taXNlLnJlc29sdmUoKTtcbmV4cG9ydCBjb25zdCBkZWZlciA9IHJlc29sdmVkID8gKGYgPT4geyByZXNvbHZlZC50aGVuKGYpOyB9KSA6IHNldFRpbWVvdXQ7XG4iLCIvLyByZW5kZXIgbW9kZXNcblxuZXhwb3J0IGNvbnN0IE5PX1JFTkRFUiA9IDA7XG5leHBvcnQgY29uc3QgU1lOQ19SRU5ERVIgPSAxO1xuZXhwb3J0IGNvbnN0IEZPUkNFX1JFTkRFUiA9IDI7XG5leHBvcnQgY29uc3QgQVNZTkNfUkVOREVSID0gMztcblxuZXhwb3J0IGNvbnN0IEVNUFRZID0ge307XG5cbmV4cG9ydCBjb25zdCBBVFRSX0tFWSA9IHR5cGVvZiBTeW1ib2whPT0ndW5kZWZpbmVkJyA/IFN5bWJvbC5mb3IoJ3ByZWFjdGF0dHInKSA6ICdfX3ByZWFjdGF0dHJfJztcblxuLy8gRE9NIHByb3BlcnRpZXMgdGhhdCBzaG91bGQgTk9UIGhhdmUgXCJweFwiIGFkZGVkIHdoZW4gbnVtZXJpY1xuZXhwb3J0IGNvbnN0IE5PTl9ESU1FTlNJT05fUFJPUFMgPSB7XG5cdGJveEZsZXg6MSwgYm94RmxleEdyb3VwOjEsIGNvbHVtbkNvdW50OjEsIGZpbGxPcGFjaXR5OjEsIGZsZXg6MSwgZmxleEdyb3c6MSxcblx0ZmxleFBvc2l0aXZlOjEsIGZsZXhTaHJpbms6MSwgZmxleE5lZ2F0aXZlOjEsIGZvbnRXZWlnaHQ6MSwgbGluZUNsYW1wOjEsIGxpbmVIZWlnaHQ6MSxcblx0b3BhY2l0eToxLCBvcmRlcjoxLCBvcnBoYW5zOjEsIHN0cm9rZU9wYWNpdHk6MSwgd2lkb3dzOjEsIHpJbmRleDoxLCB6b29tOjFcbn07XG5cbi8vIERPTSBldmVudCB0eXBlcyB0aGF0IGRvIG5vdCBidWJibGUgYW5kIHNob3VsZCBiZSBhdHRhY2hlZCB2aWEgdXNlQ2FwdHVyZVxuZXhwb3J0IGNvbnN0IE5PTl9CVUJCTElOR19FVkVOVFMgPSB7IGJsdXI6MSwgZXJyb3I6MSwgZm9jdXM6MSwgbG9hZDoxLCByZXNpemU6MSwgc2Nyb2xsOjEgfTtcbiIsImltcG9ydCB7IGlzU3RyaW5nLCBkZWx2ZSB9IGZyb20gJy4vdXRpbCc7XG5cbi8qKiBDcmVhdGUgYW4gRXZlbnQgaGFuZGxlciBmdW5jdGlvbiB0aGF0IHNldHMgYSBnaXZlbiBzdGF0ZSBwcm9wZXJ0eS5cbiAqXHRAcGFyYW0ge0NvbXBvbmVudH0gY29tcG9uZW50XHRUaGUgY29tcG9uZW50IHdob3NlIHN0YXRlIHNob3VsZCBiZSB1cGRhdGVkXG4gKlx0QHBhcmFtIHtzdHJpbmd9IGtleVx0XHRcdFx0QSBkb3Qtbm90YXRlZCBrZXkgcGF0aCB0byB1cGRhdGUgaW4gdGhlIGNvbXBvbmVudCdzIHN0YXRlXG4gKlx0QHBhcmFtIHtzdHJpbmd9IGV2ZW50UGF0aFx0XHRBIGRvdC1ub3RhdGVkIGtleSBwYXRoIHRvIHRoZSB2YWx1ZSB0aGF0IHNob3VsZCBiZSByZXRyaWV2ZWQgZnJvbSB0aGUgRXZlbnQgb3IgY29tcG9uZW50XG4gKlx0QHJldHVybnMge2Z1bmN0aW9ufSBsaW5rZWRTdGF0ZUhhbmRsZXJcbiAqXHRAcHJpdmF0ZVxuICovXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlTGlua2VkU3RhdGUoY29tcG9uZW50LCBrZXksIGV2ZW50UGF0aCkge1xuXHRsZXQgcGF0aCA9IGtleS5zcGxpdCgnLicpO1xuXHRyZXR1cm4gZnVuY3Rpb24oZSkge1xuXHRcdGxldCB0ID0gZSAmJiBlLnRhcmdldCB8fCB0aGlzLFxuXHRcdFx0c3RhdGUgPSB7fSxcblx0XHRcdG9iaiA9IHN0YXRlLFxuXHRcdFx0diA9IGlzU3RyaW5nKGV2ZW50UGF0aCkgPyBkZWx2ZShlLCBldmVudFBhdGgpIDogdC5ub2RlTmFtZSA/ICh0LnR5cGUubWF0Y2goL15jaGV8cmFkLykgPyB0LmNoZWNrZWQgOiB0LnZhbHVlKSA6IGUsXG5cdFx0XHRpID0gMDtcblx0XHRmb3IgKCA7IGk8cGF0aC5sZW5ndGgtMTsgaSsrKSB7XG5cdFx0XHRvYmogPSBvYmpbcGF0aFtpXV0gfHwgKG9ialtwYXRoW2ldXSA9ICFpICYmIGNvbXBvbmVudC5zdGF0ZVtwYXRoW2ldXSB8fCB7fSk7XG5cdFx0fVxuXHRcdG9ialtwYXRoW2ldXSA9IHY7XG5cdFx0Y29tcG9uZW50LnNldFN0YXRlKHN0YXRlKTtcblx0fTtcbn1cbiIsImltcG9ydCBvcHRpb25zIGZyb20gJy4vb3B0aW9ucyc7XG5pbXBvcnQgeyBkZWZlciB9IGZyb20gJy4vdXRpbCc7XG5pbXBvcnQgeyByZW5kZXJDb21wb25lbnQgfSBmcm9tICcuL3Zkb20vY29tcG9uZW50JztcblxuLyoqIE1hbmFnZWQgcXVldWUgb2YgZGlydHkgY29tcG9uZW50cyB0byBiZSByZS1yZW5kZXJlZCAqL1xuXG4vLyBpdGVtcy9pdGVtc09mZmxpbmUgc3dhcCBvbiBlYWNoIHJlcmVuZGVyKCkgY2FsbCAoanVzdCBhIHNpbXBsZSBwb29sIHRlY2huaXF1ZSlcbmxldCBpdGVtcyA9IFtdO1xuXG5leHBvcnQgZnVuY3Rpb24gZW5xdWV1ZVJlbmRlcihjb21wb25lbnQpIHtcblx0aWYgKCFjb21wb25lbnQuX2RpcnR5ICYmIChjb21wb25lbnQuX2RpcnR5ID0gdHJ1ZSkgJiYgaXRlbXMucHVzaChjb21wb25lbnQpPT0xKSB7XG5cdFx0KG9wdGlvbnMuZGVib3VuY2VSZW5kZXJpbmcgfHwgZGVmZXIpKHJlcmVuZGVyKTtcblx0fVxufVxuXG5cbmV4cG9ydCBmdW5jdGlvbiByZXJlbmRlcigpIHtcblx0bGV0IHAsIGxpc3QgPSBpdGVtcztcblx0aXRlbXMgPSBbXTtcblx0d2hpbGUgKCAocCA9IGxpc3QucG9wKCkpICkge1xuXHRcdGlmIChwLl9kaXJ0eSkgcmVuZGVyQ29tcG9uZW50KHApO1xuXHR9XG59XG4iLCJpbXBvcnQgeyBFTVBUWSB9IGZyb20gJy4uL2NvbnN0YW50cyc7XG5pbXBvcnQgeyBnZXROb2RlUHJvcHMgfSBmcm9tICcuL2luZGV4JztcbmltcG9ydCB7IGlzRnVuY3Rpb24gfSBmcm9tICcuLi91dGlsJztcblxuXG4vKiogQ2hlY2sgaWYgYSBWTm9kZSBpcyBhIHJlZmVyZW5jZSB0byBhIHN0YXRlbGVzcyBmdW5jdGlvbmFsIGNvbXBvbmVudC5cbiAqXHRBIGZ1bmN0aW9uIGNvbXBvbmVudCBpcyByZXByZXNlbnRlZCBhcyBhIFZOb2RlIHdob3NlIGBub2RlTmFtZWAgcHJvcGVydHkgaXMgYSByZWZlcmVuY2UgdG8gYSBmdW5jdGlvbi5cbiAqXHRJZiB0aGF0IGZ1bmN0aW9uIGlzIG5vdCBhIENvbXBvbmVudCAoaWUsIGhhcyBubyBgLnJlbmRlcigpYCBtZXRob2Qgb24gYSBwcm90b3R5cGUpLCBpdCBpcyBjb25zaWRlcmVkIGEgc3RhdGVsZXNzIGZ1bmN0aW9uYWwgY29tcG9uZW50LlxuICpcdEBwYXJhbSB7Vk5vZGV9IHZub2RlXHRBIFZOb2RlXG4gKlx0QHByaXZhdGVcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGlzRnVuY3Rpb25hbENvbXBvbmVudCh2bm9kZSkge1xuXHRsZXQgbm9kZU5hbWUgPSB2bm9kZSAmJiB2bm9kZS5ub2RlTmFtZTtcblx0cmV0dXJuIG5vZGVOYW1lICYmIGlzRnVuY3Rpb24obm9kZU5hbWUpICYmICEobm9kZU5hbWUucHJvdG90eXBlICYmIG5vZGVOYW1lLnByb3RvdHlwZS5yZW5kZXIpO1xufVxuXG5cblxuLyoqIENvbnN0cnVjdCBhIHJlc3VsdGFudCBWTm9kZSBmcm9tIGEgVk5vZGUgcmVmZXJlbmNpbmcgYSBzdGF0ZWxlc3MgZnVuY3Rpb25hbCBjb21wb25lbnQuXG4gKlx0QHBhcmFtIHtWTm9kZX0gdm5vZGVcdEEgVk5vZGUgd2l0aCBhIGBub2RlTmFtZWAgcHJvcGVydHkgdGhhdCBpcyBhIHJlZmVyZW5jZSB0byBhIGZ1bmN0aW9uLlxuICpcdEBwcml2YXRlXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBidWlsZEZ1bmN0aW9uYWxDb21wb25lbnQodm5vZGUsIGNvbnRleHQpIHtcblx0cmV0dXJuIHZub2RlLm5vZGVOYW1lKGdldE5vZGVQcm9wcyh2bm9kZSksIGNvbnRleHQgfHwgRU1QVFkpO1xufVxuIiwiaW1wb3J0IHsgY2xvbmUsIGlzU3RyaW5nLCBpc0Z1bmN0aW9uLCB0b0xvd2VyQ2FzZSB9IGZyb20gJy4uL3V0aWwnO1xuaW1wb3J0IHsgaXNGdW5jdGlvbmFsQ29tcG9uZW50IH0gZnJvbSAnLi9mdW5jdGlvbmFsLWNvbXBvbmVudCc7XG5cblxuLyoqIENoZWNrIGlmIHR3byBub2RlcyBhcmUgZXF1aXZhbGVudC5cbiAqXHRAcGFyYW0ge0VsZW1lbnR9IG5vZGVcbiAqXHRAcGFyYW0ge1ZOb2RlfSB2bm9kZVxuICpcdEBwcml2YXRlXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBpc1NhbWVOb2RlVHlwZShub2RlLCB2bm9kZSkge1xuXHRpZiAoaXNTdHJpbmcodm5vZGUpKSB7XG5cdFx0cmV0dXJuIG5vZGUgaW5zdGFuY2VvZiBUZXh0O1xuXHR9XG5cdGlmIChpc1N0cmluZyh2bm9kZS5ub2RlTmFtZSkpIHtcblx0XHRyZXR1cm4gaXNOYW1lZE5vZGUobm9kZSwgdm5vZGUubm9kZU5hbWUpO1xuXHR9XG5cdGlmIChpc0Z1bmN0aW9uKHZub2RlLm5vZGVOYW1lKSkge1xuXHRcdHJldHVybiBub2RlLl9jb21wb25lbnRDb25zdHJ1Y3Rvcj09PXZub2RlLm5vZGVOYW1lIHx8IGlzRnVuY3Rpb25hbENvbXBvbmVudCh2bm9kZSk7XG5cdH1cbn1cblxuXG5leHBvcnQgZnVuY3Rpb24gaXNOYW1lZE5vZGUobm9kZSwgbm9kZU5hbWUpIHtcblx0cmV0dXJuIG5vZGUubm9ybWFsaXplZE5vZGVOYW1lPT09bm9kZU5hbWUgfHwgdG9Mb3dlckNhc2Uobm9kZS5ub2RlTmFtZSk9PT10b0xvd2VyQ2FzZShub2RlTmFtZSk7XG59XG5cblxuLyoqXG4gKiBSZWNvbnN0cnVjdCBDb21wb25lbnQtc3R5bGUgYHByb3BzYCBmcm9tIGEgVk5vZGUuXG4gKiBFbnN1cmVzIGRlZmF1bHQvZmFsbGJhY2sgdmFsdWVzIGZyb20gYGRlZmF1bHRQcm9wc2A6XG4gKiBPd24tcHJvcGVydGllcyBvZiBgZGVmYXVsdFByb3BzYCBub3QgcHJlc2VudCBpbiBgdm5vZGUuYXR0cmlidXRlc2AgYXJlIGFkZGVkLlxuICogQHBhcmFtIHtWTm9kZX0gdm5vZGVcbiAqIEByZXR1cm5zIHtPYmplY3R9IHByb3BzXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBnZXROb2RlUHJvcHModm5vZGUpIHtcblx0bGV0IHByb3BzID0gY2xvbmUodm5vZGUuYXR0cmlidXRlcyk7XG5cdHByb3BzLmNoaWxkcmVuID0gdm5vZGUuY2hpbGRyZW47XG5cblx0bGV0IGRlZmF1bHRQcm9wcyA9IHZub2RlLm5vZGVOYW1lLmRlZmF1bHRQcm9wcztcblx0aWYgKGRlZmF1bHRQcm9wcykge1xuXHRcdGZvciAobGV0IGkgaW4gZGVmYXVsdFByb3BzKSB7XG5cdFx0XHRpZiAocHJvcHNbaV09PT11bmRlZmluZWQpIHtcblx0XHRcdFx0cHJvcHNbaV0gPSBkZWZhdWx0UHJvcHNbaV07XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0cmV0dXJuIHByb3BzO1xufVxuIiwiaW1wb3J0IHsgTk9OX0RJTUVOU0lPTl9QUk9QUywgTk9OX0JVQkJMSU5HX0VWRU5UUyB9IGZyb20gJy4uL2NvbnN0YW50cyc7XG5pbXBvcnQgb3B0aW9ucyBmcm9tICcuLi9vcHRpb25zJztcbmltcG9ydCB7IHRvTG93ZXJDYXNlLCBpc1N0cmluZywgaXNGdW5jdGlvbiwgaGFzaFRvQ2xhc3NOYW1lIH0gZnJvbSAnLi4vdXRpbCc7XG5cblxuXG5cbi8qKiBSZW1vdmVzIGEgZ2l2ZW4gRE9NIE5vZGUgZnJvbSBpdHMgcGFyZW50LiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHJlbW92ZU5vZGUobm9kZSkge1xuXHRsZXQgcCA9IG5vZGUucGFyZW50Tm9kZTtcblx0aWYgKHApIHAucmVtb3ZlQ2hpbGQobm9kZSk7XG59XG5cblxuLyoqIFNldCBhIG5hbWVkIGF0dHJpYnV0ZSBvbiB0aGUgZ2l2ZW4gTm9kZSwgd2l0aCBzcGVjaWFsIGJlaGF2aW9yIGZvciBzb21lIG5hbWVzIGFuZCBldmVudCBoYW5kbGVycy5cbiAqXHRJZiBgdmFsdWVgIGlzIGBudWxsYCwgdGhlIGF0dHJpYnV0ZS9oYW5kbGVyIHdpbGwgYmUgcmVtb3ZlZC5cbiAqXHRAcGFyYW0ge0VsZW1lbnR9IG5vZGVcdEFuIGVsZW1lbnQgdG8gbXV0YXRlXG4gKlx0QHBhcmFtIHtzdHJpbmd9IG5hbWVcdFRoZSBuYW1lL2tleSB0byBzZXQsIHN1Y2ggYXMgYW4gZXZlbnQgb3IgYXR0cmlidXRlIG5hbWVcbiAqXHRAcGFyYW0ge2FueX0gdmFsdWVcdFx0QW4gYXR0cmlidXRlIHZhbHVlLCBzdWNoIGFzIGEgZnVuY3Rpb24gdG8gYmUgdXNlZCBhcyBhbiBldmVudCBoYW5kbGVyXG4gKlx0QHBhcmFtIHthbnl9IHByZXZpb3VzVmFsdWVcdFRoZSBsYXN0IHZhbHVlIHRoYXQgd2FzIHNldCBmb3IgdGhpcyBuYW1lL25vZGUgcGFpclxuICpcdEBwcml2YXRlXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBzZXRBY2Nlc3Nvcihub2RlLCBuYW1lLCBvbGQsIHZhbHVlLCBpc1N2Zykge1xuXG5cdGlmIChuYW1lPT09J2NsYXNzTmFtZScpIG5hbWUgPSAnY2xhc3MnO1xuXG5cdGlmIChuYW1lPT09J2NsYXNzJyAmJiB2YWx1ZSAmJiB0eXBlb2YgdmFsdWU9PT0nb2JqZWN0Jykge1xuXHRcdHZhbHVlID0gaGFzaFRvQ2xhc3NOYW1lKHZhbHVlKTtcblx0fVxuXG5cdGlmIChuYW1lPT09J2tleScpIHtcblx0XHQvLyBpZ25vcmVcblx0fVxuXHRlbHNlIGlmIChuYW1lPT09J2NsYXNzJyAmJiAhaXNTdmcpIHtcblx0XHRub2RlLmNsYXNzTmFtZSA9IHZhbHVlIHx8ICcnO1xuXHR9XG5cdGVsc2UgaWYgKG5hbWU9PT0nc3R5bGUnKSB7XG5cdFx0aWYgKCF2YWx1ZSB8fCBpc1N0cmluZyh2YWx1ZSkgfHwgaXNTdHJpbmcob2xkKSkge1xuXHRcdFx0bm9kZS5zdHlsZS5jc3NUZXh0ID0gdmFsdWUgfHwgJyc7XG5cdFx0fVxuXHRcdGlmICh2YWx1ZSAmJiB0eXBlb2YgdmFsdWU9PT0nb2JqZWN0Jykge1xuXHRcdFx0aWYgKCFpc1N0cmluZyhvbGQpKSB7XG5cdFx0XHRcdGZvciAobGV0IGkgaW4gb2xkKSBpZiAoIShpIGluIHZhbHVlKSkgbm9kZS5zdHlsZVtpXSA9ICcnO1xuXHRcdFx0fVxuXHRcdFx0Zm9yIChsZXQgaSBpbiB2YWx1ZSkge1xuXHRcdFx0XHRub2RlLnN0eWxlW2ldID0gdHlwZW9mIHZhbHVlW2ldPT09J251bWJlcicgJiYgIU5PTl9ESU1FTlNJT05fUFJPUFNbaV0gPyAodmFsdWVbaV0rJ3B4JykgOiB2YWx1ZVtpXTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblx0ZWxzZSBpZiAobmFtZT09PSdkYW5nZXJvdXNseVNldElubmVySFRNTCcpIHtcblx0XHRpZiAodmFsdWUpIG5vZGUuaW5uZXJIVE1MID0gdmFsdWUuX19odG1sO1xuXHR9XG5cdGVsc2UgaWYgKG5hbWVbMF09PSdvJyAmJiBuYW1lWzFdPT0nbicpIHtcblx0XHRsZXQgbCA9IG5vZGUuX2xpc3RlbmVycyB8fCAobm9kZS5fbGlzdGVuZXJzID0ge30pO1xuXHRcdG5hbWUgPSB0b0xvd2VyQ2FzZShuYW1lLnN1YnN0cmluZygyKSk7XG5cdFx0Ly8gQFRPRE86IHRoaXMgbWlnaHQgYmUgd29ydGggaXQgbGF0ZXIsIHVuLWJyZWFrcyBmb2N1cy9ibHVyIGJ1YmJsaW5nIGluIElFOTpcblx0XHQvLyBpZiAobm9kZS5hdHRhY2hFdmVudCkgbmFtZSA9IG5hbWU9PSdmb2N1cyc/J2ZvY3VzaW4nOm5hbWU9PSdibHVyJz8nZm9jdXNvdXQnOm5hbWU7XG5cdFx0aWYgKHZhbHVlKSB7XG5cdFx0XHRpZiAoIWxbbmFtZV0pIG5vZGUuYWRkRXZlbnRMaXN0ZW5lcihuYW1lLCBldmVudFByb3h5LCAhIU5PTl9CVUJCTElOR19FVkVOVFNbbmFtZV0pO1xuXHRcdH1cblx0XHRlbHNlIGlmIChsW25hbWVdKSB7XG5cdFx0XHRub2RlLnJlbW92ZUV2ZW50TGlzdGVuZXIobmFtZSwgZXZlbnRQcm94eSwgISFOT05fQlVCQkxJTkdfRVZFTlRTW25hbWVdKTtcblx0XHR9XG5cdFx0bFtuYW1lXSA9IHZhbHVlO1xuXHR9XG5cdGVsc2UgaWYgKG5hbWUhPT0nbGlzdCcgJiYgbmFtZSE9PSd0eXBlJyAmJiAhaXNTdmcgJiYgbmFtZSBpbiBub2RlKSB7XG5cdFx0c2V0UHJvcGVydHkobm9kZSwgbmFtZSwgdmFsdWU9PW51bGwgPyAnJyA6IHZhbHVlKTtcblx0XHRpZiAodmFsdWU9PW51bGwgfHwgdmFsdWU9PT1mYWxzZSkgbm9kZS5yZW1vdmVBdHRyaWJ1dGUobmFtZSk7XG5cdH1cblx0ZWxzZSB7XG5cdFx0bGV0IG5zID0gaXNTdmcgJiYgbmFtZS5tYXRjaCgvXnhsaW5rXFw6PyguKykvKTtcblx0XHRpZiAodmFsdWU9PW51bGwgfHwgdmFsdWU9PT1mYWxzZSkge1xuXHRcdFx0aWYgKG5zKSBub2RlLnJlbW92ZUF0dHJpYnV0ZU5TKCdodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rJywgdG9Mb3dlckNhc2UobnNbMV0pKTtcblx0XHRcdGVsc2Ugbm9kZS5yZW1vdmVBdHRyaWJ1dGUobmFtZSk7XG5cdFx0fVxuXHRcdGVsc2UgaWYgKHR5cGVvZiB2YWx1ZSE9PSdvYmplY3QnICYmICFpc0Z1bmN0aW9uKHZhbHVlKSkge1xuXHRcdFx0aWYgKG5zKSBub2RlLnNldEF0dHJpYnV0ZU5TKCdodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rJywgdG9Mb3dlckNhc2UobnNbMV0pLCB2YWx1ZSk7XG5cdFx0XHRlbHNlIG5vZGUuc2V0QXR0cmlidXRlKG5hbWUsIHZhbHVlKTtcblx0XHR9XG5cdH1cbn1cblxuXG4vKiogQXR0ZW1wdCB0byBzZXQgYSBET00gcHJvcGVydHkgdG8gdGhlIGdpdmVuIHZhbHVlLlxuICpcdElFICYgRkYgdGhyb3cgZm9yIGNlcnRhaW4gcHJvcGVydHktdmFsdWUgY29tYmluYXRpb25zLlxuICovXG5mdW5jdGlvbiBzZXRQcm9wZXJ0eShub2RlLCBuYW1lLCB2YWx1ZSkge1xuXHR0cnkge1xuXHRcdG5vZGVbbmFtZV0gPSB2YWx1ZTtcblx0fSBjYXRjaCAoZSkgeyB9XG59XG5cblxuLyoqIFByb3h5IGFuIGV2ZW50IHRvIGhvb2tlZCBldmVudCBoYW5kbGVyc1xuICpcdEBwcml2YXRlXG4gKi9cbmZ1bmN0aW9uIGV2ZW50UHJveHkoZSkge1xuXHRyZXR1cm4gdGhpcy5fbGlzdGVuZXJzW2UudHlwZV0ob3B0aW9ucy5ldmVudCAmJiBvcHRpb25zLmV2ZW50KGUpIHx8IGUpO1xufVxuIiwiaW1wb3J0IHsgdG9Mb3dlckNhc2UgfSBmcm9tICcuLi91dGlsJztcbmltcG9ydCB7IHJlbW92ZU5vZGUgfSBmcm9tICcuL2luZGV4JztcblxuLyoqIERPTSBub2RlIHBvb2wsIGtleWVkIG9uIG5vZGVOYW1lLiAqL1xuXG5jb25zdCBub2RlcyA9IHt9O1xuXG5leHBvcnQgZnVuY3Rpb24gY29sbGVjdE5vZGUobm9kZSkge1xuXHRyZW1vdmVOb2RlKG5vZGUpO1xuXG5cdGlmIChub2RlIGluc3RhbmNlb2YgRWxlbWVudCkge1xuXHRcdG5vZGUuX2NvbXBvbmVudCA9IG5vZGUuX2NvbXBvbmVudENvbnN0cnVjdG9yID0gbnVsbDtcblxuXHRcdGxldCBuYW1lID0gbm9kZS5ub3JtYWxpemVkTm9kZU5hbWUgfHwgdG9Mb3dlckNhc2Uobm9kZS5ub2RlTmFtZSk7XG5cdFx0KG5vZGVzW25hbWVdIHx8IChub2Rlc1tuYW1lXSA9IFtdKSkucHVzaChub2RlKTtcblx0fVxufVxuXG5cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVOb2RlKG5vZGVOYW1lLCBpc1N2Zykge1xuXHRsZXQgbmFtZSA9IHRvTG93ZXJDYXNlKG5vZGVOYW1lKSxcblx0XHRub2RlID0gbm9kZXNbbmFtZV0gJiYgbm9kZXNbbmFtZV0ucG9wKCkgfHwgKGlzU3ZnID8gZG9jdW1lbnQuY3JlYXRlRWxlbWVudE5TKCdodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZycsIG5vZGVOYW1lKSA6IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQobm9kZU5hbWUpKTtcblx0bm9kZS5ub3JtYWxpemVkTm9kZU5hbWUgPSBuYW1lO1xuXHRyZXR1cm4gbm9kZTtcbn1cbiIsImltcG9ydCB7IEFUVFJfS0VZIH0gZnJvbSAnLi4vY29uc3RhbnRzJztcbmltcG9ydCB7IGlzU3RyaW5nLCBpc0Z1bmN0aW9uIH0gZnJvbSAnLi4vdXRpbCc7XG5pbXBvcnQgeyBpc1NhbWVOb2RlVHlwZSwgaXNOYW1lZE5vZGUgfSBmcm9tICcuL2luZGV4JztcbmltcG9ydCB7IGlzRnVuY3Rpb25hbENvbXBvbmVudCwgYnVpbGRGdW5jdGlvbmFsQ29tcG9uZW50IH0gZnJvbSAnLi9mdW5jdGlvbmFsLWNvbXBvbmVudCc7XG5pbXBvcnQgeyBidWlsZENvbXBvbmVudEZyb21WTm9kZSB9IGZyb20gJy4vY29tcG9uZW50JztcbmltcG9ydCB7IHNldEFjY2Vzc29yIH0gZnJvbSAnLi4vZG9tL2luZGV4JztcbmltcG9ydCB7IGNyZWF0ZU5vZGUsIGNvbGxlY3ROb2RlIH0gZnJvbSAnLi4vZG9tL3JlY3ljbGVyJztcbmltcG9ydCB7IHVubW91bnRDb21wb25lbnQgfSBmcm9tICcuL2NvbXBvbmVudCc7XG5pbXBvcnQgb3B0aW9ucyBmcm9tICcuLi9vcHRpb25zJztcblxuXG4vKiogRGlmZiByZWN1cnNpb24gY291bnQsIHVzZWQgdG8gdHJhY2sgdGhlIGVuZCBvZiB0aGUgZGlmZiBjeWNsZS4gKi9cbmV4cG9ydCBjb25zdCBtb3VudHMgPSBbXTtcblxuLyoqIERpZmYgcmVjdXJzaW9uIGNvdW50LCB1c2VkIHRvIHRyYWNrIHRoZSBlbmQgb2YgdGhlIGRpZmYgY3ljbGUuICovXG5leHBvcnQgbGV0IGRpZmZMZXZlbCA9IDA7XG5cbmxldCBpc1N2Z01vZGUgPSBmYWxzZTtcblxuXG5leHBvcnQgZnVuY3Rpb24gZmx1c2hNb3VudHMoKSB7XG5cdGxldCBjO1xuXHR3aGlsZSAoKGM9bW91bnRzLnBvcCgpKSkge1xuXHRcdGlmIChvcHRpb25zLmFmdGVyTW91bnQpIG9wdGlvbnMuYWZ0ZXJNb3VudChjKTtcblx0XHRpZiAoYy5jb21wb25lbnREaWRNb3VudCkgYy5jb21wb25lbnREaWRNb3VudCgpO1xuXHR9XG59XG5cblxuLyoqIEFwcGx5IGRpZmZlcmVuY2VzIGluIGEgZ2l2ZW4gdm5vZGUgKGFuZCBpdCdzIGRlZXAgY2hpbGRyZW4pIHRvIGEgcmVhbCBET00gTm9kZS5cbiAqXHRAcGFyYW0ge0VsZW1lbnR9IFtkb209bnVsbF1cdFx0QSBET00gbm9kZSB0byBtdXRhdGUgaW50byB0aGUgc2hhcGUgb2YgdGhlIGB2bm9kZWBcbiAqXHRAcGFyYW0ge1ZOb2RlfSB2bm9kZVx0XHRcdEEgVk5vZGUgKHdpdGggZGVzY2VuZGFudHMgZm9ybWluZyBhIHRyZWUpIHJlcHJlc2VudGluZyB0aGUgZGVzaXJlZCBET00gc3RydWN0dXJlXG4gKlx0QHJldHVybnMge0VsZW1lbnR9IGRvbVx0XHRcdFRoZSBjcmVhdGVkL211dGF0ZWQgZWxlbWVudFxuICpcdEBwcml2YXRlXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBkaWZmKGRvbSwgdm5vZGUsIGNvbnRleHQsIG1vdW50QWxsLCBwYXJlbnQsIGNvbXBvbmVudFJvb3QpIHtcblx0aWYgKCFkaWZmTGV2ZWwrKykgaXNTdmdNb2RlID0gcGFyZW50IGluc3RhbmNlb2YgU1ZHRWxlbWVudDtcblx0bGV0IHJldCA9IGlkaWZmKGRvbSwgdm5vZGUsIGNvbnRleHQsIG1vdW50QWxsKTtcblx0aWYgKHBhcmVudCAmJiByZXQucGFyZW50Tm9kZSE9PXBhcmVudCkgcGFyZW50LmFwcGVuZENoaWxkKHJldCk7XG5cdGlmICghLS1kaWZmTGV2ZWwgJiYgIWNvbXBvbmVudFJvb3QpIGZsdXNoTW91bnRzKCk7XG5cdHJldHVybiByZXQ7XG59XG5cblxuZnVuY3Rpb24gaWRpZmYoZG9tLCB2bm9kZSwgY29udGV4dCwgbW91bnRBbGwpIHtcblx0bGV0IG9yaWdpbmFsQXR0cmlidXRlcyA9IHZub2RlICYmIHZub2RlLmF0dHJpYnV0ZXM7XG5cblx0d2hpbGUgKGlzRnVuY3Rpb25hbENvbXBvbmVudCh2bm9kZSkpIHtcblx0XHR2bm9kZSA9IGJ1aWxkRnVuY3Rpb25hbENvbXBvbmVudCh2bm9kZSwgY29udGV4dCk7XG5cdH1cblxuXHRpZiAodm5vZGU9PW51bGwpIHZub2RlID0gJyc7XG5cblx0aWYgKGlzU3RyaW5nKHZub2RlKSkge1xuXHRcdGlmIChkb20pIHtcblx0XHRcdGlmIChkb20gaW5zdGFuY2VvZiBUZXh0ICYmIGRvbS5wYXJlbnROb2RlKSB7XG5cdFx0XHRcdGlmIChkb20ubm9kZVZhbHVlIT12bm9kZSkge1xuXHRcdFx0XHRcdGRvbS5ub2RlVmFsdWUgPSB2bm9kZTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gZG9tO1xuXHRcdFx0fVxuXHRcdFx0cmVjb2xsZWN0Tm9kZVRyZWUoZG9tKTtcblx0XHR9XG5cdFx0cmV0dXJuIGRvY3VtZW50LmNyZWF0ZVRleHROb2RlKHZub2RlKTtcblx0fVxuXG5cdGlmIChpc0Z1bmN0aW9uKHZub2RlLm5vZGVOYW1lKSkge1xuXHRcdHJldHVybiBidWlsZENvbXBvbmVudEZyb21WTm9kZShkb20sIHZub2RlLCBjb250ZXh0LCBtb3VudEFsbCk7XG5cdH1cblxuXHRsZXQgb3V0ID0gZG9tLFxuXHRcdG5vZGVOYW1lID0gdm5vZGUubm9kZU5hbWUsXG5cdFx0cHJldlN2Z01vZGUgPSBpc1N2Z01vZGUsXG5cdFx0dmNoaWxkcmVuID0gdm5vZGUuY2hpbGRyZW47XG5cblx0aWYgKCFpc1N0cmluZyhub2RlTmFtZSkpIHtcblx0XHRub2RlTmFtZSA9IFN0cmluZyhub2RlTmFtZSk7XG5cdH1cblxuXHRpc1N2Z01vZGUgPSBub2RlTmFtZT09PSdzdmcnID8gdHJ1ZSA6IG5vZGVOYW1lPT09J2ZvcmVpZ25PYmplY3QnID8gZmFsc2UgOiBpc1N2Z01vZGU7XG5cblx0aWYgKCFkb20pIHtcblx0XHRvdXQgPSBjcmVhdGVOb2RlKG5vZGVOYW1lLCBpc1N2Z01vZGUpO1xuXHR9XG5cdGVsc2UgaWYgKCFpc05hbWVkTm9kZShkb20sIG5vZGVOYW1lKSkge1xuXHRcdG91dCA9IGNyZWF0ZU5vZGUobm9kZU5hbWUsIGlzU3ZnTW9kZSk7XG5cdFx0Ly8gbW92ZSBjaGlsZHJlbiBpbnRvIHRoZSByZXBsYWNlbWVudCBub2RlXG5cdFx0d2hpbGUgKGRvbS5maXJzdENoaWxkKSBvdXQuYXBwZW5kQ2hpbGQoZG9tLmZpcnN0Q2hpbGQpO1xuXHRcdC8vIHJlY2xhaW0gZWxlbWVudCBub2Rlc1xuXHRcdHJlY29sbGVjdE5vZGVUcmVlKGRvbSk7XG5cdH1cblxuXHQvLyBmYXN0LXBhdGggZm9yIGVsZW1lbnRzIGNvbnRhaW5pbmcgYSBzaW5nbGUgVGV4dE5vZGU6XG5cdGlmICh2Y2hpbGRyZW4gJiYgdmNoaWxkcmVuLmxlbmd0aD09PTEgJiYgdHlwZW9mIHZjaGlsZHJlblswXT09PSdzdHJpbmcnICYmIG91dC5jaGlsZE5vZGVzLmxlbmd0aD09PTEgJiYgb3V0LmZpcnN0Q2hpbGQgaW5zdGFuY2VvZiBUZXh0KSB7XG5cdFx0aWYgKG91dC5maXJzdENoaWxkLm5vZGVWYWx1ZSE9dmNoaWxkcmVuWzBdKSB7XG5cdFx0XHRvdXQuZmlyc3RDaGlsZC5ub2RlVmFsdWUgPSB2Y2hpbGRyZW5bMF07XG5cdFx0fVxuXHR9XG5cdGVsc2UgaWYgKHZjaGlsZHJlbiAmJiB2Y2hpbGRyZW4ubGVuZ3RoIHx8IG91dC5maXJzdENoaWxkKSB7XG5cdFx0aW5uZXJEaWZmTm9kZShvdXQsIHZjaGlsZHJlbiwgY29udGV4dCwgbW91bnRBbGwpO1xuXHR9XG5cblx0bGV0IHByb3BzID0gb3V0W0FUVFJfS0VZXTtcblx0aWYgKCFwcm9wcykge1xuXHRcdG91dFtBVFRSX0tFWV0gPSBwcm9wcyA9IHt9O1xuXHRcdGZvciAobGV0IGE9b3V0LmF0dHJpYnV0ZXMsIGk9YS5sZW5ndGg7IGktLTsgKSBwcm9wc1thW2ldLm5hbWVdID0gYVtpXS52YWx1ZTtcblx0fVxuXG5cdGRpZmZBdHRyaWJ1dGVzKG91dCwgdm5vZGUuYXR0cmlidXRlcywgcHJvcHMpO1xuXG5cdGlmIChvcmlnaW5hbEF0dHJpYnV0ZXMgJiYgdHlwZW9mIG9yaWdpbmFsQXR0cmlidXRlcy5yZWY9PT0nZnVuY3Rpb24nKSB7XG5cdFx0KHByb3BzLnJlZiA9IG9yaWdpbmFsQXR0cmlidXRlcy5yZWYpKG91dCk7XG5cdH1cblxuXHRpc1N2Z01vZGUgPSBwcmV2U3ZnTW9kZTtcblxuXHRyZXR1cm4gb3V0O1xufVxuXG5cbi8qKiBBcHBseSBjaGlsZCBhbmQgYXR0cmlidXRlIGNoYW5nZXMgYmV0d2VlbiBhIFZOb2RlIGFuZCBhIERPTSBOb2RlIHRvIHRoZSBET00uICovXG5mdW5jdGlvbiBpbm5lckRpZmZOb2RlKGRvbSwgdmNoaWxkcmVuLCBjb250ZXh0LCBtb3VudEFsbCkge1xuXHRsZXQgb3JpZ2luYWxDaGlsZHJlbiA9IGRvbS5jaGlsZE5vZGVzLFxuXHRcdGNoaWxkcmVuID0gW10sXG5cdFx0a2V5ZWQgPSB7fSxcblx0XHRrZXllZExlbiA9IDAsXG5cdFx0bWluID0gMCxcblx0XHRsZW4gPSBvcmlnaW5hbENoaWxkcmVuLmxlbmd0aCxcblx0XHRjaGlsZHJlbkxlbiA9IDAsXG5cdFx0dmxlbiA9IHZjaGlsZHJlbiAmJiB2Y2hpbGRyZW4ubGVuZ3RoLFxuXHRcdGosIGMsIHZjaGlsZCwgY2hpbGQ7XG5cblx0aWYgKGxlbikge1xuXHRcdGZvciAobGV0IGk9MDsgaTxsZW47IGkrKykge1xuXHRcdFx0bGV0IGNoaWxkID0gb3JpZ2luYWxDaGlsZHJlbltpXSxcblx0XHRcdFx0a2V5ID0gdmxlbiA/ICgoYyA9IGNoaWxkLl9jb21wb25lbnQpID8gYy5fX2tleSA6IChjID0gY2hpbGRbQVRUUl9LRVldKSA/IGMua2V5IDogbnVsbCkgOiBudWxsO1xuXHRcdFx0aWYgKGtleSB8fCBrZXk9PT0wKSB7XG5cdFx0XHRcdGtleWVkTGVuKys7XG5cdFx0XHRcdGtleWVkW2tleV0gPSBjaGlsZDtcblx0XHRcdH1cblx0XHRcdGVsc2Uge1xuXHRcdFx0XHRjaGlsZHJlbltjaGlsZHJlbkxlbisrXSA9IGNoaWxkO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdGlmICh2bGVuKSB7XG5cdFx0Zm9yIChsZXQgaT0wOyBpPHZsZW47IGkrKykge1xuXHRcdFx0dmNoaWxkID0gdmNoaWxkcmVuW2ldO1xuXHRcdFx0Y2hpbGQgPSBudWxsO1xuXG5cdFx0XHQvLyBpZiAoaXNGdW5jdGlvbmFsQ29tcG9uZW50KHZjaGlsZCkpIHtcblx0XHRcdC8vIFx0dmNoaWxkID0gYnVpbGRGdW5jdGlvbmFsQ29tcG9uZW50KHZjaGlsZCk7XG5cdFx0XHQvLyB9XG5cblx0XHRcdC8vIGF0dGVtcHQgdG8gZmluZCBhIG5vZGUgYmFzZWQgb24ga2V5IG1hdGNoaW5nXG5cdFx0XHRsZXQga2V5ID0gdmNoaWxkLmtleTtcblx0XHRcdGlmIChrZXkhPW51bGwpIHtcblx0XHRcdFx0aWYgKGtleWVkTGVuICYmIGtleSBpbiBrZXllZCkge1xuXHRcdFx0XHRcdGNoaWxkID0ga2V5ZWRba2V5XTtcblx0XHRcdFx0XHRrZXllZFtrZXldID0gdW5kZWZpbmVkO1xuXHRcdFx0XHRcdGtleWVkTGVuLS07XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdC8vIGF0dGVtcHQgdG8gcGx1Y2sgYSBub2RlIG9mIHRoZSBzYW1lIHR5cGUgZnJvbSB0aGUgZXhpc3RpbmcgY2hpbGRyZW5cblx0XHRcdGVsc2UgaWYgKCFjaGlsZCAmJiBtaW48Y2hpbGRyZW5MZW4pIHtcblx0XHRcdFx0Zm9yIChqPW1pbjsgajxjaGlsZHJlbkxlbjsgaisrKSB7XG5cdFx0XHRcdFx0YyA9IGNoaWxkcmVuW2pdO1xuXHRcdFx0XHRcdGlmIChjICYmIGlzU2FtZU5vZGVUeXBlKGMsIHZjaGlsZCkpIHtcblx0XHRcdFx0XHRcdGNoaWxkID0gYztcblx0XHRcdFx0XHRcdGNoaWxkcmVuW2pdID0gdW5kZWZpbmVkO1xuXHRcdFx0XHRcdFx0aWYgKGo9PT1jaGlsZHJlbkxlbi0xKSBjaGlsZHJlbkxlbi0tO1xuXHRcdFx0XHRcdFx0aWYgKGo9PT1taW4pIG1pbisrO1xuXHRcdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHRcdGlmICghY2hpbGQgJiYgbWluPGNoaWxkcmVuTGVuICYmIGlzRnVuY3Rpb24odmNoaWxkLm5vZGVOYW1lKSAmJiBtb3VudEFsbCkge1xuXHRcdFx0XHRcdGNoaWxkID0gY2hpbGRyZW5bbWluXTtcblx0XHRcdFx0XHRjaGlsZHJlblttaW4rK10gPSB1bmRlZmluZWQ7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0Ly8gbW9ycGggdGhlIG1hdGNoZWQvZm91bmQvY3JlYXRlZCBET00gY2hpbGQgdG8gbWF0Y2ggdmNoaWxkIChkZWVwKVxuXHRcdFx0Y2hpbGQgPSBpZGlmZihjaGlsZCwgdmNoaWxkLCBjb250ZXh0LCBtb3VudEFsbCk7XG5cblx0XHRcdGlmIChjaGlsZCAmJiBjaGlsZCE9PWRvbSAmJiBjaGlsZCE9PW9yaWdpbmFsQ2hpbGRyZW5baV0pIHtcblx0XHRcdFx0ZG9tLmluc2VydEJlZm9yZShjaGlsZCwgb3JpZ2luYWxDaGlsZHJlbltpXSB8fCBudWxsKTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXG5cdGlmIChrZXllZExlbikge1xuXHRcdGZvciAobGV0IGkgaW4ga2V5ZWQpIGlmIChrZXllZFtpXSkgcmVjb2xsZWN0Tm9kZVRyZWUoa2V5ZWRbaV0pO1xuXHR9XG5cblx0Ly8gcmVtb3ZlIG9ycGhhbmVkIGNoaWxkcmVuXG5cdGlmIChtaW48Y2hpbGRyZW5MZW4pIHtcblx0XHRyZW1vdmVPcnBoYW5lZENoaWxkcmVuKGNoaWxkcmVuKTtcblx0fVxufVxuXG5cbi8qKiBSZWNsYWltIGNoaWxkcmVuIHRoYXQgd2VyZSB1bnJlZmVyZW5jZWQgaW4gdGhlIGRlc2lyZWQgVlRyZWUgKi9cbmV4cG9ydCBmdW5jdGlvbiByZW1vdmVPcnBoYW5lZENoaWxkcmVuKGNoaWxkcmVuLCB1bm1vdW50T25seSkge1xuXHRmb3IgKGxldCBpPWNoaWxkcmVuLmxlbmd0aDsgaS0tOyApIHtcblx0XHRpZiAoY2hpbGRyZW5baV0pIHtcblx0XHRcdHJlY29sbGVjdE5vZGVUcmVlKGNoaWxkcmVuW2ldLCB1bm1vdW50T25seSk7XG5cdFx0fVxuXHR9XG59XG5cblxuLyoqIFJlY2xhaW0gYW4gZW50aXJlIHRyZWUgb2Ygbm9kZXMsIHN0YXJ0aW5nIGF0IHRoZSByb290LiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHJlY29sbGVjdE5vZGVUcmVlKG5vZGUsIHVubW91bnRPbmx5KSB7XG5cdC8vIEBUT0RPOiBOZWVkIHRvIG1ha2UgYSBjYWxsIG9uIHdoZXRoZXIgUHJlYWN0IHNob3VsZCByZW1vdmUgbm9kZXMgbm90IGNyZWF0ZWQgYnkgaXRzZWxmLlxuXHQvLyBDdXJyZW50bHkgaXQgKmRvZXMqIHJlbW92ZSB0aGVtLiBEaXNjdXNzaW9uOiBodHRwczovL2dpdGh1Yi5jb20vZGV2ZWxvcGl0L3ByZWFjdC9pc3N1ZXMvMzlcblx0Ly9pZiAoIW5vZGVbQVRUUl9LRVldKSByZXR1cm47XG5cblx0bGV0IGNvbXBvbmVudCA9IG5vZGUuX2NvbXBvbmVudDtcblx0aWYgKGNvbXBvbmVudCkge1xuXHRcdHVubW91bnRDb21wb25lbnQoY29tcG9uZW50LCAhdW5tb3VudE9ubHkpO1xuXHR9XG5cdGVsc2Uge1xuXHRcdGlmIChub2RlW0FUVFJfS0VZXSAmJiBub2RlW0FUVFJfS0VZXS5yZWYpIG5vZGVbQVRUUl9LRVldLnJlZihudWxsKTtcblxuXHRcdGlmICghdW5tb3VudE9ubHkpIHtcblx0XHRcdGNvbGxlY3ROb2RlKG5vZGUpO1xuXHRcdH1cblxuXHRcdGlmIChub2RlLmNoaWxkTm9kZXMgJiYgbm9kZS5jaGlsZE5vZGVzLmxlbmd0aCkge1xuXHRcdFx0cmVtb3ZlT3JwaGFuZWRDaGlsZHJlbihub2RlLmNoaWxkTm9kZXMsIHVubW91bnRPbmx5KTtcblx0XHR9XG5cdH1cbn1cblxuXG4vKiogQXBwbHkgZGlmZmVyZW5jZXMgaW4gYXR0cmlidXRlcyBmcm9tIGEgVk5vZGUgdG8gdGhlIGdpdmVuIERPTSBOb2RlLiAqL1xuZnVuY3Rpb24gZGlmZkF0dHJpYnV0ZXMoZG9tLCBhdHRycywgb2xkKSB7XG5cdGZvciAobGV0IG5hbWUgaW4gb2xkKSB7XG5cdFx0aWYgKCEoYXR0cnMgJiYgbmFtZSBpbiBhdHRycykgJiYgb2xkW25hbWVdIT1udWxsKSB7XG5cdFx0XHRzZXRBY2Nlc3Nvcihkb20sIG5hbWUsIG9sZFtuYW1lXSwgb2xkW25hbWVdID0gdW5kZWZpbmVkLCBpc1N2Z01vZGUpO1xuXHRcdH1cblx0fVxuXG5cdC8vIG5ldyAmIHVwZGF0ZWRcblx0aWYgKGF0dHJzKSB7XG5cdFx0Zm9yIChsZXQgbmFtZSBpbiBhdHRycykge1xuXHRcdFx0aWYgKG5hbWUhPT0nY2hpbGRyZW4nICYmIG5hbWUhPT0naW5uZXJIVE1MJyAmJiAoIShuYW1lIGluIG9sZCkgfHwgYXR0cnNbbmFtZV0hPT0obmFtZT09PSd2YWx1ZScgfHwgbmFtZT09PSdjaGVja2VkJyA/IGRvbVtuYW1lXSA6IG9sZFtuYW1lXSkpKSB7XG5cdFx0XHRcdHNldEFjY2Vzc29yKGRvbSwgbmFtZSwgb2xkW25hbWVdLCBvbGRbbmFtZV0gPSBhdHRyc1tuYW1lXSwgaXNTdmdNb2RlKTtcblx0XHRcdH1cblx0XHR9XG5cdH1cbn1cbiIsImltcG9ydCB7IENvbXBvbmVudCB9IGZyb20gJy4uL2NvbXBvbmVudCc7XG5cbi8qKiBSZXRhaW5zIGEgcG9vbCBvZiBDb21wb25lbnRzIGZvciByZS11c2UsIGtleWVkIG9uIGNvbXBvbmVudCBuYW1lLlxuICpcdE5vdGU6IHNpbmNlIGNvbXBvbmVudCBuYW1lcyBhcmUgbm90IHVuaXF1ZSBvciBldmVuIG5lY2Vzc2FyaWx5IGF2YWlsYWJsZSwgdGhlc2UgYXJlIHByaW1hcmlseSBhIGZvcm0gb2Ygc2hhcmRpbmcuXG4gKlx0QHByaXZhdGVcbiAqL1xuY29uc3QgY29tcG9uZW50cyA9IHt9O1xuXG5cbmV4cG9ydCBmdW5jdGlvbiBjb2xsZWN0Q29tcG9uZW50KGNvbXBvbmVudCkge1xuXHRsZXQgbmFtZSA9IGNvbXBvbmVudC5jb25zdHJ1Y3Rvci5uYW1lLFxuXHRcdGxpc3QgPSBjb21wb25lbnRzW25hbWVdO1xuXHRpZiAobGlzdCkgbGlzdC5wdXNoKGNvbXBvbmVudCk7XG5cdGVsc2UgY29tcG9uZW50c1tuYW1lXSA9IFtjb21wb25lbnRdO1xufVxuXG5cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVDb21wb25lbnQoQ3RvciwgcHJvcHMsIGNvbnRleHQpIHtcblx0bGV0IGluc3QgPSBuZXcgQ3Rvcihwcm9wcywgY29udGV4dCksXG5cdFx0bGlzdCA9IGNvbXBvbmVudHNbQ3Rvci5uYW1lXTtcblx0Q29tcG9uZW50LmNhbGwoaW5zdCwgcHJvcHMsIGNvbnRleHQpO1xuXHRpZiAobGlzdCkge1xuXHRcdGZvciAobGV0IGk9bGlzdC5sZW5ndGg7IGktLTsgKSB7XG5cdFx0XHRpZiAobGlzdFtpXS5jb25zdHJ1Y3Rvcj09PUN0b3IpIHtcblx0XHRcdFx0aW5zdC5uZXh0QmFzZSA9IGxpc3RbaV0ubmV4dEJhc2U7XG5cdFx0XHRcdGxpc3Quc3BsaWNlKGksIDEpO1xuXHRcdFx0XHRicmVhaztcblx0XHRcdH1cblx0XHR9XG5cdH1cblx0cmV0dXJuIGluc3Q7XG59XG4iLCJpbXBvcnQgeyBTWU5DX1JFTkRFUiwgTk9fUkVOREVSLCBGT1JDRV9SRU5ERVIsIEFTWU5DX1JFTkRFUiwgQVRUUl9LRVkgfSBmcm9tICcuLi9jb25zdGFudHMnO1xuaW1wb3J0IG9wdGlvbnMgZnJvbSAnLi4vb3B0aW9ucyc7XG5pbXBvcnQgeyBpc0Z1bmN0aW9uLCBjbG9uZSwgZXh0ZW5kIH0gZnJvbSAnLi4vdXRpbCc7XG5pbXBvcnQgeyBlbnF1ZXVlUmVuZGVyIH0gZnJvbSAnLi4vcmVuZGVyLXF1ZXVlJztcbmltcG9ydCB7IGdldE5vZGVQcm9wcyB9IGZyb20gJy4vaW5kZXgnO1xuaW1wb3J0IHsgZGlmZiwgbW91bnRzLCBkaWZmTGV2ZWwsIGZsdXNoTW91bnRzLCByZW1vdmVPcnBoYW5lZENoaWxkcmVuLCByZWNvbGxlY3ROb2RlVHJlZSB9IGZyb20gJy4vZGlmZic7XG5pbXBvcnQgeyBpc0Z1bmN0aW9uYWxDb21wb25lbnQsIGJ1aWxkRnVuY3Rpb25hbENvbXBvbmVudCB9IGZyb20gJy4vZnVuY3Rpb25hbC1jb21wb25lbnQnO1xuaW1wb3J0IHsgY3JlYXRlQ29tcG9uZW50LCBjb2xsZWN0Q29tcG9uZW50IH0gZnJvbSAnLi9jb21wb25lbnQtcmVjeWNsZXInO1xuaW1wb3J0IHsgcmVtb3ZlTm9kZSB9IGZyb20gJy4uL2RvbS9pbmRleCc7XG5cblxuXG4vKiogU2V0IGEgY29tcG9uZW50J3MgYHByb3BzYCAoZ2VuZXJhbGx5IGRlcml2ZWQgZnJvbSBKU1ggYXR0cmlidXRlcykuXG4gKlx0QHBhcmFtIHtPYmplY3R9IHByb3BzXG4gKlx0QHBhcmFtIHtPYmplY3R9IFtvcHRzXVxuICpcdEBwYXJhbSB7Ym9vbGVhbn0gW29wdHMucmVuZGVyU3luYz1mYWxzZV1cdElmIGB0cnVlYCBhbmQge0BsaW5rIG9wdGlvbnMuc3luY0NvbXBvbmVudFVwZGF0ZXN9IGlzIGB0cnVlYCwgdHJpZ2dlcnMgc3luY2hyb25vdXMgcmVuZGVyaW5nLlxuICpcdEBwYXJhbSB7Ym9vbGVhbn0gW29wdHMucmVuZGVyPXRydWVdXHRcdFx0SWYgYGZhbHNlYCwgbm8gcmVuZGVyIHdpbGwgYmUgdHJpZ2dlcmVkLlxuICovXG5leHBvcnQgZnVuY3Rpb24gc2V0Q29tcG9uZW50UHJvcHMoY29tcG9uZW50LCBwcm9wcywgb3B0cywgY29udGV4dCwgbW91bnRBbGwpIHtcblx0aWYgKGNvbXBvbmVudC5fZGlzYWJsZSkgcmV0dXJuO1xuXHRjb21wb25lbnQuX2Rpc2FibGUgPSB0cnVlO1xuXG5cdGlmICgoY29tcG9uZW50Ll9fcmVmID0gcHJvcHMucmVmKSkgZGVsZXRlIHByb3BzLnJlZjtcblx0aWYgKChjb21wb25lbnQuX19rZXkgPSBwcm9wcy5rZXkpKSBkZWxldGUgcHJvcHMua2V5O1xuXG5cdGlmICghY29tcG9uZW50LmJhc2UgfHwgbW91bnRBbGwpIHtcblx0XHRpZiAoY29tcG9uZW50LmNvbXBvbmVudFdpbGxNb3VudCkgY29tcG9uZW50LmNvbXBvbmVudFdpbGxNb3VudCgpO1xuXHR9XG5cdGVsc2UgaWYgKGNvbXBvbmVudC5jb21wb25lbnRXaWxsUmVjZWl2ZVByb3BzKSB7XG5cdFx0Y29tcG9uZW50LmNvbXBvbmVudFdpbGxSZWNlaXZlUHJvcHMocHJvcHMsIGNvbnRleHQpO1xuXHR9XG5cblx0aWYgKGNvbnRleHQgJiYgY29udGV4dCE9PWNvbXBvbmVudC5jb250ZXh0KSB7XG5cdFx0aWYgKCFjb21wb25lbnQucHJldkNvbnRleHQpIGNvbXBvbmVudC5wcmV2Q29udGV4dCA9IGNvbXBvbmVudC5jb250ZXh0O1xuXHRcdGNvbXBvbmVudC5jb250ZXh0ID0gY29udGV4dDtcblx0fVxuXG5cdGlmICghY29tcG9uZW50LnByZXZQcm9wcykgY29tcG9uZW50LnByZXZQcm9wcyA9IGNvbXBvbmVudC5wcm9wcztcblx0Y29tcG9uZW50LnByb3BzID0gcHJvcHM7XG5cblx0Y29tcG9uZW50Ll9kaXNhYmxlID0gZmFsc2U7XG5cblx0aWYgKG9wdHMhPT1OT19SRU5ERVIpIHtcblx0XHRpZiAob3B0cz09PVNZTkNfUkVOREVSIHx8IG9wdGlvbnMuc3luY0NvbXBvbmVudFVwZGF0ZXMhPT1mYWxzZSB8fCAhY29tcG9uZW50LmJhc2UpIHtcblx0XHRcdHJlbmRlckNvbXBvbmVudChjb21wb25lbnQsIFNZTkNfUkVOREVSLCBtb3VudEFsbCk7XG5cdFx0fVxuXHRcdGVsc2Uge1xuXHRcdFx0ZW5xdWV1ZVJlbmRlcihjb21wb25lbnQpO1xuXHRcdH1cblx0fVxuXG5cdGlmIChjb21wb25lbnQuX19yZWYpIGNvbXBvbmVudC5fX3JlZihjb21wb25lbnQpO1xufVxuXG5cblxuLyoqIFJlbmRlciBhIENvbXBvbmVudCwgdHJpZ2dlcmluZyBuZWNlc3NhcnkgbGlmZWN5Y2xlIGV2ZW50cyBhbmQgdGFraW5nIEhpZ2gtT3JkZXIgQ29tcG9uZW50cyBpbnRvIGFjY291bnQuXG4gKlx0QHBhcmFtIHtDb21wb25lbnR9IGNvbXBvbmVudFxuICpcdEBwYXJhbSB7T2JqZWN0fSBbb3B0c11cbiAqXHRAcGFyYW0ge2Jvb2xlYW59IFtvcHRzLmJ1aWxkPWZhbHNlXVx0XHRJZiBgdHJ1ZWAsIGNvbXBvbmVudCB3aWxsIGJ1aWxkIGFuZCBzdG9yZSBhIERPTSBub2RlIGlmIG5vdCBhbHJlYWR5IGFzc29jaWF0ZWQgd2l0aCBvbmUuXG4gKlx0QHByaXZhdGVcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHJlbmRlckNvbXBvbmVudChjb21wb25lbnQsIG9wdHMsIG1vdW50QWxsLCBpc0NoaWxkKSB7XG5cdGlmIChjb21wb25lbnQuX2Rpc2FibGUpIHJldHVybjtcblxuXHRsZXQgc2tpcCwgcmVuZGVyZWQsXG5cdFx0cHJvcHMgPSBjb21wb25lbnQucHJvcHMsXG5cdFx0c3RhdGUgPSBjb21wb25lbnQuc3RhdGUsXG5cdFx0Y29udGV4dCA9IGNvbXBvbmVudC5jb250ZXh0LFxuXHRcdHByZXZpb3VzUHJvcHMgPSBjb21wb25lbnQucHJldlByb3BzIHx8IHByb3BzLFxuXHRcdHByZXZpb3VzU3RhdGUgPSBjb21wb25lbnQucHJldlN0YXRlIHx8IHN0YXRlLFxuXHRcdHByZXZpb3VzQ29udGV4dCA9IGNvbXBvbmVudC5wcmV2Q29udGV4dCB8fCBjb250ZXh0LFxuXHRcdGlzVXBkYXRlID0gY29tcG9uZW50LmJhc2UsXG5cdFx0bmV4dEJhc2UgPSBjb21wb25lbnQubmV4dEJhc2UsXG5cdFx0aW5pdGlhbEJhc2UgPSBpc1VwZGF0ZSB8fCBuZXh0QmFzZSxcblx0XHRpbml0aWFsQ2hpbGRDb21wb25lbnQgPSBjb21wb25lbnQuX2NvbXBvbmVudCxcblx0XHRpbnN0LCBjYmFzZTtcblxuXHQvLyBpZiB1cGRhdGluZ1xuXHRpZiAoaXNVcGRhdGUpIHtcblx0XHRjb21wb25lbnQucHJvcHMgPSBwcmV2aW91c1Byb3BzO1xuXHRcdGNvbXBvbmVudC5zdGF0ZSA9IHByZXZpb3VzU3RhdGU7XG5cdFx0Y29tcG9uZW50LmNvbnRleHQgPSBwcmV2aW91c0NvbnRleHQ7XG5cdFx0aWYgKG9wdHMhPT1GT1JDRV9SRU5ERVJcblx0XHRcdCYmIGNvbXBvbmVudC5zaG91bGRDb21wb25lbnRVcGRhdGVcblx0XHRcdCYmIGNvbXBvbmVudC5zaG91bGRDb21wb25lbnRVcGRhdGUocHJvcHMsIHN0YXRlLCBjb250ZXh0KSA9PT0gZmFsc2UpIHtcblx0XHRcdHNraXAgPSB0cnVlO1xuXHRcdH1cblx0XHRlbHNlIGlmIChjb21wb25lbnQuY29tcG9uZW50V2lsbFVwZGF0ZSkge1xuXHRcdFx0Y29tcG9uZW50LmNvbXBvbmVudFdpbGxVcGRhdGUocHJvcHMsIHN0YXRlLCBjb250ZXh0KTtcblx0XHR9XG5cdFx0Y29tcG9uZW50LnByb3BzID0gcHJvcHM7XG5cdFx0Y29tcG9uZW50LnN0YXRlID0gc3RhdGU7XG5cdFx0Y29tcG9uZW50LmNvbnRleHQgPSBjb250ZXh0O1xuXHR9XG5cblx0Y29tcG9uZW50LnByZXZQcm9wcyA9IGNvbXBvbmVudC5wcmV2U3RhdGUgPSBjb21wb25lbnQucHJldkNvbnRleHQgPSBjb21wb25lbnQubmV4dEJhc2UgPSBudWxsO1xuXHRjb21wb25lbnQuX2RpcnR5ID0gZmFsc2U7XG5cblx0aWYgKCFza2lwKSB7XG5cdFx0aWYgKGNvbXBvbmVudC5yZW5kZXIpIHJlbmRlcmVkID0gY29tcG9uZW50LnJlbmRlcihwcm9wcywgc3RhdGUsIGNvbnRleHQpO1xuXG5cdFx0Ly8gY29udGV4dCB0byBwYXNzIHRvIHRoZSBjaGlsZCwgY2FuIGJlIHVwZGF0ZWQgdmlhIChncmFuZC0pcGFyZW50IGNvbXBvbmVudFxuXHRcdGlmIChjb21wb25lbnQuZ2V0Q2hpbGRDb250ZXh0KSB7XG5cdFx0XHRjb250ZXh0ID0gZXh0ZW5kKGNsb25lKGNvbnRleHQpLCBjb21wb25lbnQuZ2V0Q2hpbGRDb250ZXh0KCkpO1xuXHRcdH1cblxuXHRcdHdoaWxlIChpc0Z1bmN0aW9uYWxDb21wb25lbnQocmVuZGVyZWQpKSB7XG5cdFx0XHRyZW5kZXJlZCA9IGJ1aWxkRnVuY3Rpb25hbENvbXBvbmVudChyZW5kZXJlZCwgY29udGV4dCk7XG5cdFx0fVxuXG5cdFx0bGV0IGNoaWxkQ29tcG9uZW50ID0gcmVuZGVyZWQgJiYgcmVuZGVyZWQubm9kZU5hbWUsXG5cdFx0XHR0b1VubW91bnQsIGJhc2U7XG5cblx0XHRpZiAoaXNGdW5jdGlvbihjaGlsZENvbXBvbmVudCkpIHtcblx0XHRcdC8vIHNldCB1cCBoaWdoIG9yZGVyIGNvbXBvbmVudCBsaW5rXG5cblxuXHRcdFx0aW5zdCA9IGluaXRpYWxDaGlsZENvbXBvbmVudDtcblx0XHRcdGxldCBjaGlsZFByb3BzID0gZ2V0Tm9kZVByb3BzKHJlbmRlcmVkKTtcblxuXHRcdFx0aWYgKGluc3QgJiYgaW5zdC5jb25zdHJ1Y3Rvcj09PWNoaWxkQ29tcG9uZW50KSB7XG5cdFx0XHRcdHNldENvbXBvbmVudFByb3BzKGluc3QsIGNoaWxkUHJvcHMsIFNZTkNfUkVOREVSLCBjb250ZXh0KTtcblx0XHRcdH1cblx0XHRcdGVsc2Uge1xuXHRcdFx0XHR0b1VubW91bnQgPSBpbnN0O1xuXG5cdFx0XHRcdGluc3QgPSBjcmVhdGVDb21wb25lbnQoY2hpbGRDb21wb25lbnQsIGNoaWxkUHJvcHMsIGNvbnRleHQpO1xuXHRcdFx0XHRpbnN0Lm5leHRCYXNlID0gaW5zdC5uZXh0QmFzZSB8fCBuZXh0QmFzZTtcblx0XHRcdFx0aW5zdC5fcGFyZW50Q29tcG9uZW50ID0gY29tcG9uZW50O1xuXHRcdFx0XHRjb21wb25lbnQuX2NvbXBvbmVudCA9IGluc3Q7XG5cdFx0XHRcdHNldENvbXBvbmVudFByb3BzKGluc3QsIGNoaWxkUHJvcHMsIE5PX1JFTkRFUiwgY29udGV4dCk7XG5cdFx0XHRcdHJlbmRlckNvbXBvbmVudChpbnN0LCBTWU5DX1JFTkRFUiwgbW91bnRBbGwsIHRydWUpO1xuXHRcdFx0fVxuXG5cdFx0XHRiYXNlID0gaW5zdC5iYXNlO1xuXHRcdH1cblx0XHRlbHNlIHtcblx0XHRcdGNiYXNlID0gaW5pdGlhbEJhc2U7XG5cblx0XHRcdC8vIGRlc3Ryb3kgaGlnaCBvcmRlciBjb21wb25lbnQgbGlua1xuXHRcdFx0dG9Vbm1vdW50ID0gaW5pdGlhbENoaWxkQ29tcG9uZW50O1xuXHRcdFx0aWYgKHRvVW5tb3VudCkge1xuXHRcdFx0XHRjYmFzZSA9IGNvbXBvbmVudC5fY29tcG9uZW50ID0gbnVsbDtcblx0XHRcdH1cblxuXHRcdFx0aWYgKGluaXRpYWxCYXNlIHx8IG9wdHM9PT1TWU5DX1JFTkRFUikge1xuXHRcdFx0XHRpZiAoY2Jhc2UpIGNiYXNlLl9jb21wb25lbnQgPSBudWxsO1xuXHRcdFx0XHRiYXNlID0gZGlmZihjYmFzZSwgcmVuZGVyZWQsIGNvbnRleHQsIG1vdW50QWxsIHx8ICFpc1VwZGF0ZSwgaW5pdGlhbEJhc2UgJiYgaW5pdGlhbEJhc2UucGFyZW50Tm9kZSwgdHJ1ZSk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0aWYgKGluaXRpYWxCYXNlICYmIGJhc2UhPT1pbml0aWFsQmFzZSAmJiBpbnN0IT09aW5pdGlhbENoaWxkQ29tcG9uZW50KSB7XG5cdFx0XHRsZXQgYmFzZVBhcmVudCA9IGluaXRpYWxCYXNlLnBhcmVudE5vZGU7XG5cdFx0XHRpZiAoYmFzZVBhcmVudCAmJiBiYXNlIT09YmFzZVBhcmVudCkge1xuXHRcdFx0XHRiYXNlUGFyZW50LnJlcGxhY2VDaGlsZChiYXNlLCBpbml0aWFsQmFzZSk7XG5cblx0XHRcdFx0aWYgKCF0b1VubW91bnQpIHtcblx0XHRcdFx0XHRpbml0aWFsQmFzZS5fY29tcG9uZW50ID0gbnVsbDtcblx0XHRcdFx0XHRyZWNvbGxlY3ROb2RlVHJlZShpbml0aWFsQmFzZSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cblx0XHRpZiAodG9Vbm1vdW50KSB7XG5cdFx0XHR1bm1vdW50Q29tcG9uZW50KHRvVW5tb3VudCwgYmFzZSE9PWluaXRpYWxCYXNlKTtcblx0XHR9XG5cblx0XHRjb21wb25lbnQuYmFzZSA9IGJhc2U7XG5cdFx0aWYgKGJhc2UgJiYgIWlzQ2hpbGQpIHtcblx0XHRcdGxldCBjb21wb25lbnRSZWYgPSBjb21wb25lbnQsXG5cdFx0XHRcdHQgPSBjb21wb25lbnQ7XG5cdFx0XHR3aGlsZSAoKHQ9dC5fcGFyZW50Q29tcG9uZW50KSkge1xuXHRcdFx0XHQoY29tcG9uZW50UmVmID0gdCkuYmFzZSA9IGJhc2U7XG5cdFx0XHR9XG5cdFx0XHRiYXNlLl9jb21wb25lbnQgPSBjb21wb25lbnRSZWY7XG5cdFx0XHRiYXNlLl9jb21wb25lbnRDb25zdHJ1Y3RvciA9IGNvbXBvbmVudFJlZi5jb25zdHJ1Y3Rvcjtcblx0XHR9XG5cdH1cblxuXHRpZiAoIWlzVXBkYXRlIHx8IG1vdW50QWxsKSB7XG5cdFx0bW91bnRzLnVuc2hpZnQoY29tcG9uZW50KTtcblx0fVxuXHRlbHNlIGlmICghc2tpcCkge1xuXHRcdGlmIChjb21wb25lbnQuY29tcG9uZW50RGlkVXBkYXRlKSB7XG5cdFx0XHRjb21wb25lbnQuY29tcG9uZW50RGlkVXBkYXRlKHByZXZpb3VzUHJvcHMsIHByZXZpb3VzU3RhdGUsIHByZXZpb3VzQ29udGV4dCk7XG5cdFx0fVxuXHRcdGlmIChvcHRpb25zLmFmdGVyVXBkYXRlKSBvcHRpb25zLmFmdGVyVXBkYXRlKGNvbXBvbmVudCk7XG5cdH1cblxuXHRsZXQgY2IgPSBjb21wb25lbnQuX3JlbmRlckNhbGxiYWNrcywgZm47XG5cdGlmIChjYikgd2hpbGUgKCAoZm4gPSBjYi5wb3AoKSkgKSBmbi5jYWxsKGNvbXBvbmVudCk7XG5cblx0aWYgKCFkaWZmTGV2ZWwgJiYgIWlzQ2hpbGQpIGZsdXNoTW91bnRzKCk7XG59XG5cblxuXG4vKiogQXBwbHkgdGhlIENvbXBvbmVudCByZWZlcmVuY2VkIGJ5IGEgVk5vZGUgdG8gdGhlIERPTS5cbiAqXHRAcGFyYW0ge0VsZW1lbnR9IGRvbVx0VGhlIERPTSBub2RlIHRvIG11dGF0ZVxuICpcdEBwYXJhbSB7Vk5vZGV9IHZub2RlXHRBIENvbXBvbmVudC1yZWZlcmVuY2luZyBWTm9kZVxuICpcdEByZXR1cm5zIHtFbGVtZW50fSBkb21cdFRoZSBjcmVhdGVkL211dGF0ZWQgZWxlbWVudFxuICpcdEBwcml2YXRlXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBidWlsZENvbXBvbmVudEZyb21WTm9kZShkb20sIHZub2RlLCBjb250ZXh0LCBtb3VudEFsbCkge1xuXHRsZXQgYyA9IGRvbSAmJiBkb20uX2NvbXBvbmVudCxcblx0XHRvbGREb20gPSBkb20sXG5cdFx0aXNEaXJlY3RPd25lciA9IGMgJiYgZG9tLl9jb21wb25lbnRDb25zdHJ1Y3Rvcj09PXZub2RlLm5vZGVOYW1lLFxuXHRcdGlzT3duZXIgPSBpc0RpcmVjdE93bmVyLFxuXHRcdHByb3BzID0gZ2V0Tm9kZVByb3BzKHZub2RlKTtcblx0d2hpbGUgKGMgJiYgIWlzT3duZXIgJiYgKGM9Yy5fcGFyZW50Q29tcG9uZW50KSkge1xuXHRcdGlzT3duZXIgPSBjLmNvbnN0cnVjdG9yPT09dm5vZGUubm9kZU5hbWU7XG5cdH1cblxuXHRpZiAoYyAmJiBpc093bmVyICYmICghbW91bnRBbGwgfHwgYy5fY29tcG9uZW50KSkge1xuXHRcdHNldENvbXBvbmVudFByb3BzKGMsIHByb3BzLCBBU1lOQ19SRU5ERVIsIGNvbnRleHQsIG1vdW50QWxsKTtcblx0XHRkb20gPSBjLmJhc2U7XG5cdH1cblx0ZWxzZSB7XG5cdFx0aWYgKGMgJiYgIWlzRGlyZWN0T3duZXIpIHtcblx0XHRcdHVubW91bnRDb21wb25lbnQoYywgdHJ1ZSk7XG5cdFx0XHRkb20gPSBvbGREb20gPSBudWxsO1xuXHRcdH1cblxuXHRcdGMgPSBjcmVhdGVDb21wb25lbnQodm5vZGUubm9kZU5hbWUsIHByb3BzLCBjb250ZXh0KTtcblx0XHRpZiAoZG9tICYmICFjLm5leHRCYXNlKSB7XG5cdFx0XHRjLm5leHRCYXNlID0gZG9tO1xuXHRcdFx0Ly8gcGFzc2luZyBkb20vb2xkRG9tIGFzIG5leHRCYXNlIHdpbGwgcmVjeWNsZSBpdCBpZiB1bnVzZWQsIHNvIGJ5cGFzcyByZWN5Y2xpbmcgb24gTDI0MTpcblx0XHRcdG9sZERvbSA9IG51bGw7XG5cdFx0fVxuXHRcdHNldENvbXBvbmVudFByb3BzKGMsIHByb3BzLCBTWU5DX1JFTkRFUiwgY29udGV4dCwgbW91bnRBbGwpO1xuXHRcdGRvbSA9IGMuYmFzZTtcblxuXHRcdGlmIChvbGREb20gJiYgZG9tIT09b2xkRG9tKSB7XG5cdFx0XHRvbGREb20uX2NvbXBvbmVudCA9IG51bGw7XG5cdFx0XHRyZWNvbGxlY3ROb2RlVHJlZShvbGREb20pO1xuXHRcdH1cblx0fVxuXG5cdHJldHVybiBkb207XG59XG5cblxuXG4vKiogUmVtb3ZlIGEgY29tcG9uZW50IGZyb20gdGhlIERPTSBhbmQgcmVjeWNsZSBpdC5cbiAqXHRAcGFyYW0ge0VsZW1lbnR9IGRvbVx0XHRcdEEgRE9NIG5vZGUgZnJvbSB3aGljaCB0byB1bm1vdW50IHRoZSBnaXZlbiBDb21wb25lbnRcbiAqXHRAcGFyYW0ge0NvbXBvbmVudH0gY29tcG9uZW50XHRUaGUgQ29tcG9uZW50IGluc3RhbmNlIHRvIHVubW91bnRcbiAqXHRAcHJpdmF0ZVxuICovXG5leHBvcnQgZnVuY3Rpb24gdW5tb3VudENvbXBvbmVudChjb21wb25lbnQsIHJlbW92ZSkge1xuXHRpZiAob3B0aW9ucy5iZWZvcmVVbm1vdW50KSBvcHRpb25zLmJlZm9yZVVubW91bnQoY29tcG9uZW50KTtcblxuXHQvLyBjb25zb2xlLmxvZyhgJHtyZW1vdmU/J1JlbW92aW5nJzonVW5tb3VudGluZyd9IGNvbXBvbmVudDogJHtjb21wb25lbnQuY29uc3RydWN0b3IubmFtZX1gKTtcblx0bGV0IGJhc2UgPSBjb21wb25lbnQuYmFzZTtcblxuXHRjb21wb25lbnQuX2Rpc2FibGUgPSB0cnVlO1xuXG5cdGlmIChjb21wb25lbnQuY29tcG9uZW50V2lsbFVubW91bnQpIGNvbXBvbmVudC5jb21wb25lbnRXaWxsVW5tb3VudCgpO1xuXG5cdGNvbXBvbmVudC5iYXNlID0gbnVsbDtcblxuXHQvLyByZWN1cnNpdmVseSB0ZWFyIGRvd24gJiByZWNvbGxlY3QgaGlnaC1vcmRlciBjb21wb25lbnQgY2hpbGRyZW46XG5cdGxldCBpbm5lciA9IGNvbXBvbmVudC5fY29tcG9uZW50O1xuXHRpZiAoaW5uZXIpIHtcblx0XHR1bm1vdW50Q29tcG9uZW50KGlubmVyLCByZW1vdmUpO1xuXHR9XG5cdGVsc2UgaWYgKGJhc2UpIHtcblx0XHRpZiAoYmFzZVtBVFRSX0tFWV0gJiYgYmFzZVtBVFRSX0tFWV0ucmVmKSBiYXNlW0FUVFJfS0VZXS5yZWYobnVsbCk7XG5cblx0XHRjb21wb25lbnQubmV4dEJhc2UgPSBiYXNlO1xuXG5cdFx0aWYgKHJlbW92ZSkge1xuXHRcdFx0cmVtb3ZlTm9kZShiYXNlKTtcblx0XHRcdGNvbGxlY3RDb21wb25lbnQoY29tcG9uZW50KTtcblx0XHR9XG5cdFx0cmVtb3ZlT3JwaGFuZWRDaGlsZHJlbihiYXNlLmNoaWxkTm9kZXMsICFyZW1vdmUpO1xuXHR9XG5cblx0aWYgKGNvbXBvbmVudC5fX3JlZikgY29tcG9uZW50Ll9fcmVmKG51bGwpO1xuXHRpZiAoY29tcG9uZW50LmNvbXBvbmVudERpZFVubW91bnQpIGNvbXBvbmVudC5jb21wb25lbnREaWRVbm1vdW50KCk7XG59XG4iLCJpbXBvcnQgeyBGT1JDRV9SRU5ERVIgfSBmcm9tICcuL2NvbnN0YW50cyc7XG5pbXBvcnQgeyBleHRlbmQsIGNsb25lLCBpc0Z1bmN0aW9uIH0gZnJvbSAnLi91dGlsJztcbmltcG9ydCB7IGNyZWF0ZUxpbmtlZFN0YXRlIH0gZnJvbSAnLi9saW5rZWQtc3RhdGUnO1xuaW1wb3J0IHsgcmVuZGVyQ29tcG9uZW50IH0gZnJvbSAnLi92ZG9tL2NvbXBvbmVudCc7XG5pbXBvcnQgeyBlbnF1ZXVlUmVuZGVyIH0gZnJvbSAnLi9yZW5kZXItcXVldWUnO1xuXG4vKiogQmFzZSBDb21wb25lbnQgY2xhc3MsIGZvciBoZSBFUzYgQ2xhc3MgbWV0aG9kIG9mIGNyZWF0aW5nIENvbXBvbmVudHNcbiAqXHRAcHVibGljXG4gKlxuICpcdEBleGFtcGxlXG4gKlx0Y2xhc3MgTXlGb28gZXh0ZW5kcyBDb21wb25lbnQge1xuICpcdFx0cmVuZGVyKHByb3BzLCBzdGF0ZSkge1xuICpcdFx0XHRyZXR1cm4gPGRpdiAvPjtcbiAqXHRcdH1cbiAqXHR9XG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBDb21wb25lbnQocHJvcHMsIGNvbnRleHQpIHtcblx0LyoqIEBwcml2YXRlICovXG5cdHRoaXMuX2RpcnR5ID0gdHJ1ZTtcblx0Ly8gLyoqIEBwdWJsaWMgKi9cblx0Ly8gdGhpcy5fZGlzYWJsZVJlbmRlcmluZyA9IGZhbHNlO1xuXHQvLyAvKiogQHB1YmxpYyAqL1xuXHQvLyB0aGlzLnByZXZTdGF0ZSA9IHRoaXMucHJldlByb3BzID0gdGhpcy5wcmV2Q29udGV4dCA9IHRoaXMuYmFzZSA9IHRoaXMubmV4dEJhc2UgPSB0aGlzLl9wYXJlbnRDb21wb25lbnQgPSB0aGlzLl9jb21wb25lbnQgPSB0aGlzLl9fcmVmID0gdGhpcy5fX2tleSA9IHRoaXMuX2xpbmtlZFN0YXRlcyA9IHRoaXMuX3JlbmRlckNhbGxiYWNrcyA9IG51bGw7XG5cdC8qKiBAcHVibGljICovXG5cdHRoaXMuY29udGV4dCA9IGNvbnRleHQ7XG5cdC8qKiBAdHlwZSB7b2JqZWN0fSAqL1xuXHR0aGlzLnByb3BzID0gcHJvcHM7XG5cdC8qKiBAdHlwZSB7b2JqZWN0fSAqL1xuXHRpZiAoIXRoaXMuc3RhdGUpIHRoaXMuc3RhdGUgPSB7fTtcbn1cblxuXG5leHRlbmQoQ29tcG9uZW50LnByb3RvdHlwZSwge1xuXG5cdC8qKiBSZXR1cm5zIGEgYGJvb2xlYW5gIHZhbHVlIGluZGljYXRpbmcgaWYgdGhlIGNvbXBvbmVudCBzaG91bGQgcmUtcmVuZGVyIHdoZW4gcmVjZWl2aW5nIHRoZSBnaXZlbiBgcHJvcHNgIGFuZCBgc3RhdGVgLlxuXHQgKlx0QHBhcmFtIHtvYmplY3R9IG5leHRQcm9wc1xuXHQgKlx0QHBhcmFtIHtvYmplY3R9IG5leHRTdGF0ZVxuXHQgKlx0QHBhcmFtIHtvYmplY3R9IG5leHRDb250ZXh0XG5cdCAqXHRAcmV0dXJucyB7Qm9vbGVhbn0gc2hvdWxkIHRoZSBjb21wb25lbnQgcmUtcmVuZGVyXG5cdCAqXHRAbmFtZSBzaG91bGRDb21wb25lbnRVcGRhdGVcblx0ICpcdEBmdW5jdGlvblxuXHQgKi9cblx0Ly8gc2hvdWxkQ29tcG9uZW50VXBkYXRlKCkge1xuXHQvLyBcdHJldHVybiB0cnVlO1xuXHQvLyB9LFxuXG5cblx0LyoqIFJldHVybnMgYSBmdW5jdGlvbiB0aGF0IHNldHMgYSBzdGF0ZSBwcm9wZXJ0eSB3aGVuIGNhbGxlZC5cblx0ICpcdENhbGxpbmcgbGlua1N0YXRlKCkgcmVwZWF0ZWRseSB3aXRoIHRoZSBzYW1lIGFyZ3VtZW50cyByZXR1cm5zIGEgY2FjaGVkIGxpbmsgZnVuY3Rpb24uXG5cdCAqXG5cdCAqXHRQcm92aWRlcyBzb21lIGJ1aWx0LWluIHNwZWNpYWwgY2FzZXM6XG5cdCAqXHRcdC0gQ2hlY2tib3hlcyBhbmQgcmFkaW8gYnV0dG9ucyBsaW5rIHRoZWlyIGJvb2xlYW4gYGNoZWNrZWRgIHZhbHVlXG5cdCAqXHRcdC0gSW5wdXRzIGF1dG9tYXRpY2FsbHkgbGluayB0aGVpciBgdmFsdWVgIHByb3BlcnR5XG5cdCAqXHRcdC0gRXZlbnQgcGF0aHMgZmFsbCBiYWNrIHRvIGFueSBhc3NvY2lhdGVkIENvbXBvbmVudCBpZiBub3QgZm91bmQgb24gYW4gZWxlbWVudFxuXHQgKlx0XHQtIElmIGxpbmtlZCB2YWx1ZSBpcyBhIGZ1bmN0aW9uLCB3aWxsIGludm9rZSBpdCBhbmQgdXNlIHRoZSByZXN1bHRcblx0ICpcblx0ICpcdEBwYXJhbSB7c3RyaW5nfSBrZXlcdFx0XHRcdFRoZSBwYXRoIHRvIHNldCAtIGNhbiBiZSBhIGRvdC1ub3RhdGVkIGRlZXAga2V5XG5cdCAqXHRAcGFyYW0ge3N0cmluZ30gW2V2ZW50UGF0aF1cdFx0SWYgc2V0LCBhdHRlbXB0cyB0byBmaW5kIHRoZSBuZXcgc3RhdGUgdmFsdWUgYXQgYSBnaXZlbiBkb3Qtbm90YXRlZCBwYXRoIHdpdGhpbiB0aGUgb2JqZWN0IHBhc3NlZCB0byB0aGUgbGlua2VkU3RhdGUgc2V0dGVyLlxuXHQgKlx0QHJldHVybnMge2Z1bmN0aW9ufSBsaW5rU3RhdGVTZXR0ZXIoZSlcblx0ICpcblx0ICpcdEBleGFtcGxlIFVwZGF0ZSBhIFwidGV4dFwiIHN0YXRlIHZhbHVlIHdoZW4gYW4gaW5wdXQgY2hhbmdlczpcblx0ICpcdFx0PGlucHV0IG9uQ2hhbmdlPXsgdGhpcy5saW5rU3RhdGUoJ3RleHQnKSB9IC8+XG5cdCAqXG5cdCAqXHRAZXhhbXBsZSBTZXQgYSBkZWVwIHN0YXRlIHZhbHVlIG9uIGNsaWNrXG5cdCAqXHRcdDxidXR0b24gb25DbGljaz17IHRoaXMubGlua1N0YXRlKCd0b3VjaC5jb29yZHMnLCAndG91Y2hlcy4wJykgfT5UYXA8L2J1dHRvblxuXHQgKi9cblx0bGlua1N0YXRlKGtleSwgZXZlbnRQYXRoKSB7XG5cdFx0bGV0IGMgPSB0aGlzLl9saW5rZWRTdGF0ZXMgfHwgKHRoaXMuX2xpbmtlZFN0YXRlcyA9IHt9KTtcblx0XHRyZXR1cm4gY1trZXkrZXZlbnRQYXRoXSB8fCAoY1trZXkrZXZlbnRQYXRoXSA9IGNyZWF0ZUxpbmtlZFN0YXRlKHRoaXMsIGtleSwgZXZlbnRQYXRoKSk7XG5cdH0sXG5cblxuXHQvKiogVXBkYXRlIGNvbXBvbmVudCBzdGF0ZSBieSBjb3B5aW5nIHByb3BlcnRpZXMgZnJvbSBgc3RhdGVgIHRvIGB0aGlzLnN0YXRlYC5cblx0ICpcdEBwYXJhbSB7b2JqZWN0fSBzdGF0ZVx0XHRBIGhhc2ggb2Ygc3RhdGUgcHJvcGVydGllcyB0byB1cGRhdGUgd2l0aCBuZXcgdmFsdWVzXG5cdCAqL1xuXHRzZXRTdGF0ZShzdGF0ZSwgY2FsbGJhY2spIHtcblx0XHRsZXQgcyA9IHRoaXMuc3RhdGU7XG5cdFx0aWYgKCF0aGlzLnByZXZTdGF0ZSkgdGhpcy5wcmV2U3RhdGUgPSBjbG9uZShzKTtcblx0XHRleHRlbmQocywgaXNGdW5jdGlvbihzdGF0ZSkgPyBzdGF0ZShzLCB0aGlzLnByb3BzKSA6IHN0YXRlKTtcblx0XHRpZiAoY2FsbGJhY2spICh0aGlzLl9yZW5kZXJDYWxsYmFja3MgPSAodGhpcy5fcmVuZGVyQ2FsbGJhY2tzIHx8IFtdKSkucHVzaChjYWxsYmFjayk7XG5cdFx0ZW5xdWV1ZVJlbmRlcih0aGlzKTtcblx0fSxcblxuXG5cdC8qKiBJbW1lZGlhdGVseSBwZXJmb3JtIGEgc3luY2hyb25vdXMgcmUtcmVuZGVyIG9mIHRoZSBjb21wb25lbnQuXG5cdCAqXHRAcHJpdmF0ZVxuXHQgKi9cblx0Zm9yY2VVcGRhdGUoKSB7XG5cdFx0cmVuZGVyQ29tcG9uZW50KHRoaXMsIEZPUkNFX1JFTkRFUik7XG5cdH0sXG5cblxuXHQvKiogQWNjZXB0cyBgcHJvcHNgIGFuZCBgc3RhdGVgLCBhbmQgcmV0dXJucyBhIG5ldyBWaXJ0dWFsIERPTSB0cmVlIHRvIGJ1aWxkLlxuXHQgKlx0VmlydHVhbCBET00gaXMgZ2VuZXJhbGx5IGNvbnN0cnVjdGVkIHZpYSBbSlNYXShodHRwOi8vamFzb25mb3JtYXQuY29tL3d0Zi1pcy1qc3gpLlxuXHQgKlx0QHBhcmFtIHtvYmplY3R9IHByb3BzXHRcdFByb3BzIChlZzogSlNYIGF0dHJpYnV0ZXMpIHJlY2VpdmVkIGZyb20gcGFyZW50IGVsZW1lbnQvY29tcG9uZW50XG5cdCAqXHRAcGFyYW0ge29iamVjdH0gc3RhdGVcdFx0VGhlIGNvbXBvbmVudCdzIGN1cnJlbnQgc3RhdGVcblx0ICpcdEBwYXJhbSB7b2JqZWN0fSBjb250ZXh0XHRcdENvbnRleHQgb2JqZWN0IChpZiBhIHBhcmVudCBjb21wb25lbnQgaGFzIHByb3ZpZGVkIGNvbnRleHQpXG5cdCAqXHRAcmV0dXJucyBWTm9kZVxuXHQgKi9cblx0cmVuZGVyKCkge31cblxufSk7XG4iLCJpbXBvcnQgeyBkaWZmIH0gZnJvbSAnLi92ZG9tL2RpZmYnO1xuXG4vKiogUmVuZGVyIEpTWCBpbnRvIGEgYHBhcmVudGAgRWxlbWVudC5cbiAqXHRAcGFyYW0ge1ZOb2RlfSB2bm9kZVx0XHRBIChKU1gpIFZOb2RlIHRvIHJlbmRlclxuICpcdEBwYXJhbSB7RWxlbWVudH0gcGFyZW50XHRcdERPTSBlbGVtZW50IHRvIHJlbmRlciBpbnRvXG4gKlx0QHBhcmFtIHtFbGVtZW50fSBbbWVyZ2VdXHRBdHRlbXB0IHRvIHJlLXVzZSBhbiBleGlzdGluZyBET00gdHJlZSByb290ZWQgYXQgYG1lcmdlYFxuICpcdEBwdWJsaWNcbiAqXG4gKlx0QGV4YW1wbGVcbiAqXHQvLyByZW5kZXIgYSBkaXYgaW50byA8Ym9keT46XG4gKlx0cmVuZGVyKDxkaXYgaWQ9XCJoZWxsb1wiPmhlbGxvITwvZGl2PiwgZG9jdW1lbnQuYm9keSk7XG4gKlxuICpcdEBleGFtcGxlXG4gKlx0Ly8gcmVuZGVyIGEgXCJUaGluZ1wiIGNvbXBvbmVudCBpbnRvICNmb286XG4gKlx0Y29uc3QgVGhpbmcgPSAoeyBuYW1lIH0pID0+IDxzcGFuPnsgbmFtZSB9PC9zcGFuPjtcbiAqXHRyZW5kZXIoPFRoaW5nIG5hbWU9XCJvbmVcIiAvPiwgZG9jdW1lbnQucXVlcnlTZWxlY3RvcignI2ZvbycpKTtcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHJlbmRlcih2bm9kZSwgcGFyZW50LCBtZXJnZSkge1xuXHRyZXR1cm4gZGlmZihtZXJnZSwgdm5vZGUsIHt9LCBmYWxzZSwgcGFyZW50KTtcbn1cbiIsIi8qXG4gQ29weXJpZ2h0IChDKSAyMDE2LTIwMTcgVGhlYXRlcnNvZnRcblxuIFRoaXMgcHJvZ3JhbSBpcyBmcmVlIHNvZnR3YXJlOiB5b3UgY2FuIHJlZGlzdHJpYnV0ZSBpdCBhbmQvb3IgbW9kaWZ5IGl0IHVuZGVyXG4gdGhlIHRlcm1zIG9mIHRoZSBHTlUgQWZmZXJvIEdlbmVyYWwgUHVibGljIExpY2Vuc2UgYXMgcHVibGlzaGVkIGJ5IHRoZSBGcmVlXG4gU29mdHdhcmUgRm91bmRhdGlvbiwgdmVyc2lvbiAzLlxuXG4gVGhpcyBwcm9ncmFtIGlzIGRpc3RyaWJ1dGVkIGluIHRoZSBob3BlIHRoYXQgaXQgd2lsbCBiZSB1c2VmdWwsIGJ1dCBXSVRIT1VUXG4gQU5ZIFdBUlJBTlRZOyB3aXRob3V0IGV2ZW4gdGhlIGltcGxpZWQgd2FycmFudHkgb2YgTUVSQ0hBTlRBQklMSVRZIG9yIEZJVE5FU1NcbiBGT1IgQSBQQVJUSUNVTEFSIFBVUlBPU0UuIFNlZSB0aGUgR05VIEFmZmVybyBHZW5lcmFsIFB1YmxpYyBMaWNlbnNlIGZvciBtb3JlXG4gZGV0YWlscy5cblxuIFlvdSBzaG91bGQgaGF2ZSByZWNlaXZlZCBhIGNvcHkgb2YgdGhlIEdOVSBBZmZlcm8gR2VuZXJhbCBQdWJsaWMgTGljZW5zZSBhbG9uZ1xuIHdpdGggdGhpcyBwcm9ncmFtLiBJZiBub3QsIHNlZSA8aHR0cDovL3d3dy5nbnUub3JnL2xpY2Vuc2VzLz5cbiAqL1xuY2xhc3MgQmFzZSB7fVxuXG5mdW5jdGlvbiBtaXhpbkV2ZW50RW1pdHRlcihCYXNlKSB7XG4gICAgcmV0dXJuIGNsYXNzIEV2ZW50RW1pdHRlciBleHRlbmRzIEJhc2Uge1xuICAgICAgICBjb25zdHJ1Y3RvciguLi5hcmdzKSB7XG4gICAgICAgICAgICBzdXBlciguLi5hcmdzKTtcbiAgICAgICAgICAgIHRoaXMuZXZlbnRzIC8qOiBNYXA8RXZlbnQsIEFycmF5PENhbGxiYWNrPj4qLyA9IG5ldyBNYXAoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGFrYSBhZGRMaXN0ZW5lclxuICAgICAgICBvbih0eXBlLCBjYWxsYmFjaykge1xuICAgICAgICAgICAgdGhpcy5ldmVudHMuaGFzKHR5cGUpIHx8IHRoaXMuZXZlbnRzLnNldCh0eXBlLCBbXSk7XG4gICAgICAgICAgICB0aGlzLmV2ZW50cy5nZXQodHlwZSkucHVzaChjYWxsYmFjayk7XG4gICAgICAgICAgICByZXR1cm4gdGhpcztcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGFrYSByZW1vdmVMaXN0ZW5lclxuICAgICAgICBvZmYodHlwZSwgY2FsbGJhY2spIHtcbiAgICAgICAgICAgIGNvbnN0IGNhbGxiYWNrcyA9IHRoaXMuZXZlbnRzLmdldCh0eXBlKTtcbiAgICAgICAgICAgIGlmIChjYWxsYmFja3MgJiYgY2FsbGJhY2tzLmxlbmd0aCkgdGhpcy5ldmVudHMuc2V0KHR5cGUsIGNhbGxiYWNrcy5maWx0ZXIoY2IgPT4gY2IgIT09IGNhbGxiYWNrKSk7XG4gICAgICAgIH1cblxuICAgICAgICBlbWl0KHR5cGUsIC4uLmFyZ3MpIHtcbiAgICAgICAgICAgIGNvbnN0IGNhbGxiYWNrcyA9IHRoaXMuZXZlbnRzLmdldCh0eXBlKTtcbiAgICAgICAgICAgIGlmIChjYWxsYmFja3MgJiYgY2FsbGJhY2tzLmxlbmd0aCkge1xuICAgICAgICAgICAgICAgIGNhbGxiYWNrcy5mb3JFYWNoKGNiID0+IGNiKC4uLmFyZ3MpKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuICAgIH07XG59XG5cbmNsYXNzIEV2ZW50RW1pdHRlciBleHRlbmRzIG1peGluRXZlbnRFbWl0dGVyKEJhc2UpIHt9XG5cbmNvbnN0IGxvZyQxID0gY29uc29sZS5sb2cuYmluZChjb25zb2xlKTtcbmNvbnN0IGVycm9yJDEgPSBjb25zb2xlLmVycm9yLmJpbmQoY29uc29sZSk7XG5cbmNvbnN0IHRhZyA9ICdCVVMnO1xuY29uc3QgZm9ybWF0ID0gKC4uLmFyZ3MpID0+IFt0YWcsIC4uLmFyZ3NdO1xuXG5jb25zdCBsb2ckJDEgPSAoLi4uYXJncykgPT4gbG9nJDEoLi4uZm9ybWF0KC4uLmFyZ3MpKTtcbmNvbnN0IGVycm9yJCQxID0gKC4uLmFyZ3MpID0+IGVycm9yJDEoLi4uZm9ybWF0KC4uLmFyZ3MpKTtcblxuZnVuY3Rpb24gcHJveHkobmFtZSkge1xuICAgIGxldCBbLCBwYXRoLCBpbnRmXSA9IC9eKFsvXFxkXSspKFxcdyspJC8uZXhlYyhuYW1lKSB8fCBbdW5kZWZpbmVkLCB1bmRlZmluZWQsIG5hbWVdO1xuICAgIHJldHVybiBuZXcgUHJveHkoe30sIHtcbiAgICAgICAgZ2V0KF8sIG1lbWJlcikge1xuICAgICAgICAgICAgcmV0dXJuICguLi5hcmdzKSA9PiAocGF0aCA/IFByb21pc2UucmVzb2x2ZSgpIDogbWFuYWdlci5yZXNvbHZlTmFtZShpbnRmKS50aGVuKHAgPT4ge1xuICAgICAgICAgICAgICAgIHBhdGggPSBwO1xuICAgICAgICAgICAgfSkpLnRoZW4oKCkgPT4gbm9kZS5yZXF1ZXN0KHsgcGF0aCwgaW50ZiwgbWVtYmVyLCBhcmdzIH0pKTtcbiAgICAgICAgfVxuICAgIH0pO1xufVxuXG5mdW5jdGlvbiBtZXRob2RzKG9iaikge1xuICAgIHJldHVybiBPYmplY3QuZ2V0T3duUHJvcGVydHlOYW1lcyhPYmplY3QuZ2V0UHJvdG90eXBlT2Yob2JqKSkuZmlsdGVyKHAgPT4gdHlwZW9mIG9ialtwXSA9PT0gJ2Z1bmN0aW9uJyAmJiBwICE9PSAnY29uc3RydWN0b3InKTtcbn1cblxuZnVuY3Rpb24gcGFyZW50U3RhcnR1cChDb25uZWN0aW9uQmFzZSkge1xuICAgIC8vIGZpeCBUeXBlRXJyb3IgaW4gYXJyb3cgZnVuY3Rpb24gd2l0aG91dCBicmFjZXMgcmV0dXJuaW5nIGEgZnVuY3Rpb25cbiAgICAvLyBodHRwczovL2dpdGh1Yi5jb20vcm9sbHVwL3JvbGx1cC9wdWxsLzEwNjJcbiAgICByZXR1cm4gY2xhc3MgZXh0ZW5kcyBDb25uZWN0aW9uQmFzZSB7XG4gICAgICAgIGNvbnN0cnVjdG9yKC4uLmFyZ3MpIHtcbiAgICAgICAgICAgIHN1cGVyKC4uLmFyZ3MpO1xuICAgICAgICAgICAgY29uc3QgeyBwYXJlbnQ6IHsgYXV0aDogQVVUSCB9IH0gPSBjb25uZWN0aW9uLmNvbnRleHQsXG4gICAgICAgICAgICAgICAgICBvbmhlbGxvID0gKHsgaGVsbG8gfSkgPT4ge1xuICAgICAgICAgICAgICAgIGlmIChoZWxsbykge1xuICAgICAgICAgICAgICAgICAgICAvL2xvZygncGFyZW50U3RhcnR1cCBvbmhlbGxvJywgaGVsbG8pXG4gICAgICAgICAgICAgICAgICAgIHRoaXMubmFtZSA9IGAke2hlbGxvfTBgO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmVtaXQoJ2Nvbm5lY3QnLCBoZWxsbyk7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMub2ZmKCdkYXRhJywgb25oZWxsbyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgIG9uYXV0aCA9ICh7IGF1dGggfSkgPT4ge1xuICAgICAgICAgICAgICAgIC8vbG9nKCdwYXJlbnRTdGFydHVwIG9uYXV0aCcsIGF1dGgpXG4gICAgICAgICAgICAgICAgdGhpcy5zZW5kKHsgYXV0aDogQVVUSCB9KTtcbiAgICAgICAgICAgICAgICB0aGlzLm9mZignZGF0YScsIG9uYXV0aCk7XG4gICAgICAgICAgICAgICAgdGhpcy5vbignZGF0YScsIG9uaGVsbG8pO1xuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIHRoaXMub24oJ2RhdGEnLCBBVVRIID8gb25hdXRoIDogb25oZWxsbyk7XG4gICAgICAgICAgICAvL2xvZygncGFyZW50U3RhcnR1cCBhdXRoJywgQVVUSClcbiAgICAgICAgfVxuICAgIH07XG59XG5cbmNsYXNzIEJyb3dzZXJDb25uZWN0aW9uIGV4dGVuZHMgRXZlbnRFbWl0dGVyIHtcbiAgICBjb25zdHJ1Y3Rvcih3cykge1xuICAgICAgICBzdXBlcigpO1xuICAgICAgICB0aGlzLndzID0gd3M7XG4gICAgICAgIGNvbnN0IHNlbGYgPSB0aGlzO1xuICAgICAgICB3cy5vbm9wZW4gPSAoKSA9PiBzZWxmLmVtaXQoJ29wZW4nKTtcbiAgICAgICAgd3Mub25tZXNzYWdlID0gZXYgPT4gc2VsZi5lbWl0KCdkYXRhJywgSlNPTi5wYXJzZShldi5kYXRhKSk7XG4gICAgICAgIHdzLm9uY2xvc2UgPSBldiA9PiB7XG4gICAgICAgICAgICBsb2ckJDEoJ2Nvbm5lY3Rpb24gY2xvc2UnLCB0aGlzLm5hbWUpO1xuICAgICAgICAgICAgc2VsZi5lbWl0KCdjbG9zZScpO1xuICAgICAgICB9O1xuICAgICAgICB3cy5vbmVycm9yID0gZXYgPT4gc2VsZi5lbWl0KCdlcnJvcicsIGV2KTtcbiAgICB9XG4gICAgc2VuZChkYXRhKSB7XG4gICAgICAgIC8vbG9nLmxvZyhgY29ubmVjdGlvbiAke3RoaXMubmFtZX0gc2VuZGAsIGRhdGEpXG4gICAgICAgIHRoaXMud3Muc2VuZChKU09OLnN0cmluZ2lmeShkYXRhKSk7XG4gICAgfVxufVxuXG5jbGFzcyBQYXJlbnRDb25uZWN0aW9uIGV4dGVuZHMgcGFyZW50U3RhcnR1cChCcm93c2VyQ29ubmVjdGlvbikge31cblxubGV0IGNvbnRleHQ7XG5cbnZhciBjb25uZWN0aW9uID0ge1xuICAgIGNyZWF0ZSh2YWx1ZSA9IHt9KSB7XG4gICAgICAgIGNvbnN0IHsgcGFyZW50OiB7IHVybCA9IGAke2xvY2F0aW9uLnByb3RvY29sID09PSAnaHR0cHM6JyA/ICd3c3MnIDogJ3dzJ306Ly8ke2xvY2F0aW9uLmhvc3R9YCwgYXV0aCB9ID0ge30gfSA9IHZhbHVlO1xuICAgICAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKGF1dGgpLnRoZW4oYXV0aCA9PiB7XG4gICAgICAgICAgICBjb250ZXh0ID0geyBwYXJlbnQ6IHsgdXJsLCBhdXRoIH0gfTtcbiAgICAgICAgfSk7XG4gICAgfSxcblxuICAgIGdldCBjb250ZXh0KCkge1xuICAgICAgICBpZiAoIWNvbnRleHQpIHRocm93IG5ldyBFcnJvcignSW52YWxpZCBidXMgY29udGV4dCcpO1xuICAgICAgICByZXR1cm4gY29udGV4dDtcbiAgICB9LFxuXG4gICAgZ2V0IGhhc1BhcmVudCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuY29udGV4dC5wYXJlbnQgJiYgdGhpcy5jb250ZXh0LnBhcmVudC51cmw7XG4gICAgfSxcblxuICAgIGdldCBoYXNDaGlsZHJlbigpIHtcbiAgICAgICAgcmV0dXJuICEhdGhpcy5jb250ZXh0LmNoaWxkcmVuO1xuICAgIH0sXG5cbiAgICBjcmVhdGVQYXJlbnRDb25uZWN0aW9uKCkge1xuICAgICAgICByZXR1cm4gbmV3IFBhcmVudENvbm5lY3Rpb24obmV3IFdlYlNvY2tldCh0aGlzLmNvbnRleHQucGFyZW50LnVybCkpO1xuICAgIH0sXG5cbiAgICBjcmVhdGVTZXJ2ZXIoKSB7XG4gICAgICAgIHRocm93ICdub3QgaW1wbGVtZW50ZWQnO1xuICAgIH1cbn07XG5cbmNsYXNzIE1hbmFnZXIge1xuICAgIGluaXQocGF0aCkge1xuICAgICAgICAvL2xvZyhgbWFuYWdlci5pbml0IGFzICR7bm9kZS5yb290ID8gJ3Jvb3QnIDogJ3Byb3h5J31gKVxuICAgICAgICBpZiAobm9kZS5yb290KSB7XG4gICAgICAgICAgICB0aGlzLm5hbWVzIC8qOiBNYXA8QnVzTmFtZSwgQnVzUGF0aD4qLyA9IG5ldyBNYXAoKTtcbiAgICAgICAgICAgIHRoaXMubm9kZXMgLyo6IE1hcDxCdXNQYXRoLCBBcnJheTxCdXNOYW1lPj4qLyA9IG5ldyBNYXAoKTtcbiAgICAgICAgICAgIG5vZGUucmVnaXN0ZXJPYmplY3QoJ0J1cycsIHRoaXMsIG1ldGhvZHModGhpcyksIHsgc2VuZGVyOiB0cnVlIH0pO1xuICAgICAgICB9IGVsc2UgdGhpcy5wcm94eSA9IHByb3h5KCcvQnVzJyk7XG4gICAgICAgIC8vdGhpcy5wcm94aWVzIC8qOiBNYXA8QnVzTmFtZSwgQnVzUGF0aD4qLyA9IG5ldyBNYXAoKVxuICAgICAgICB0aGlzLmFkZE5vZGUocGF0aCk7XG4gICAgfVxuXG4gICAgYWRkTm9kZShwYXRoKSB7XG4gICAgICAgIGlmICh0aGlzLnByb3h5KSByZXR1cm4gdGhpcy5wcm94eS5hZGROb2RlKHBhdGgpO1xuICAgICAgICBsb2ckJDEoJ21hbmFnZXIuYWRkTm9kZScsIHBhdGgpO1xuICAgICAgICBpZiAodGhpcy5ub2Rlcy5oYXMocGF0aCkpIHJldHVybiBQcm9taXNlLnJlamVjdCgnZHVwbGljYXRlIG5vZGUnKTtcbiAgICAgICAgdGhpcy5ub2Rlcy5zZXQocGF0aCwgbmV3IEFycmF5KCkpO1xuICAgICAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKCk7XG4gICAgfVxuXG4gICAgcmVtb3ZlTm9kZShwYXRoKSB7XG4gICAgICAgIGlmICh0aGlzLnByb3h5KSByZXR1cm4gdGhpcy5wcm94eS5yZW1vdmVOb2RlKHBhdGgpO1xuICAgICAgICBsb2ckJDEoJ21hbmFnZXIucmVtb3ZlTm9kZScsIHBhdGgpO1xuICAgICAgICBpZiAoIXRoaXMubm9kZXMuaGFzKHBhdGgpKSByZXR1cm4gUHJvbWlzZS5yZWplY3QoJ21pc3Npbmcgbm9kZScpO1xuICAgICAgICByZXR1cm4gUHJvbWlzZS5hbGwodGhpcy5ub2Rlcy5nZXQocGF0aCkuc2xpY2UoKS5tYXAobmFtZSA9PiB0aGlzLnJlbW92ZU5hbWUobmFtZSkpIC8vIFRPRE8gcmVtb3ZlIGNoaWxkcmVuXG4gICAgICAgICkudGhlbigoKSA9PiB0aGlzLm5vZGVzLmRlbGV0ZShwYXRoKSk7XG4gICAgfVxuXG4gICAgYWRkTmFtZShuYW1lLCBfc2VuZGVyKSB7XG4gICAgICAgIGlmICh0aGlzLnByb3h5KSByZXR1cm4gdGhpcy5wcm94eS5hZGROYW1lKG5hbWUpO1xuICAgICAgICBsb2ckJDEoJ21hbmFnZXIuYWRkTmFtZScsIG5hbWUpO1xuICAgICAgICBpZiAodGhpcy5uYW1lcy5oYXMobmFtZSkpIHJldHVybiBQcm9taXNlLnJlamVjdCgnZHVwbGljYXRlIG5hbWUnKTtcbiAgICAgICAgdGhpcy5uYW1lcy5zZXQobmFtZSwgX3NlbmRlcik7XG4gICAgICAgIGlmICghdGhpcy5ub2Rlcy5oYXMoX3NlbmRlcikpIHJldHVybiBQcm9taXNlLnJlamVjdCgnbWlzc2luZyBub2RlJyk7XG4gICAgICAgIHRoaXMubm9kZXMuZ2V0KF9zZW5kZXIpLnB1c2gobmFtZSk7XG4gICAgICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUoKTtcbiAgICB9XG5cbiAgICByZXNvbHZlTmFtZShuYW1lKSB7XG4gICAgICAgIGlmICh0aGlzLnByb3h5KSByZXR1cm4gdGhpcy5wcm94eS5yZXNvbHZlTmFtZShuYW1lKTtcbiAgICAgICAgaWYgKCF0aGlzLm5hbWVzLmhhcyhuYW1lKSkgcmV0dXJuIFByb21pc2UucmVqZWN0KCdtaXNzaW5nIG5hbWUnKTtcbiAgICAgICAgbG9nJCQxKCdtYW5hZ2VyLnJlc29sdmVOYW1lJywgbmFtZSwgdGhpcy5uYW1lcy5nZXQobmFtZSkpO1xuICAgICAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKHRoaXMubmFtZXMuZ2V0KG5hbWUpKTtcbiAgICB9XG5cbiAgICByZW1vdmVOYW1lKG5hbWUsIF9zZW5kZXIpIHtcbiAgICAgICAgaWYgKHRoaXMucHJveHkpIHJldHVybiB0aGlzLnByb3h5LnJlbW92ZU5hbWUobmFtZSk7XG4gICAgICAgIGxvZyQkMSgnbWFuYWdlci5yZW1vdmVOYW1lJywgbmFtZSk7XG4gICAgICAgIGlmICghdGhpcy5uYW1lcy5oYXMobmFtZSkpIHJldHVybiBQcm9taXNlLnJlamVjdCgnbWlzc2luZyBuYW1lJyk7XG4gICAgICAgIGNvbnN0IHBhdGggPSB0aGlzLm5hbWVzLmdldChuYW1lKTtcbiAgICAgICAgdGhpcy5uYW1lcy5kZWxldGUobmFtZSk7XG4gICAgICAgIC8vIFRPRE8gY2hlY2sgcGF0aD09PV9zZW5kZXJcbiAgICAgICAgaWYgKCF0aGlzLm5vZGVzLmhhcyhwYXRoKSkgcmV0dXJuIFByb21pc2UucmVqZWN0KCdtaXNzaW5nIG5vZGUnKTtcbiAgICAgICAgY29uc3QgbmFtZXMgPSB0aGlzLm5vZGVzLmdldChwYXRoKSxcbiAgICAgICAgICAgICAgaSA9IG5hbWVzLmluZGV4T2YobmFtZSk7XG4gICAgICAgIGlmIChpID09PSAtMSkgcmV0dXJuIFByb21pc2UucmVqZWN0KCdtaXNzaW5nIG5hbWUnKTtcbiAgICAgICAgbmFtZXMuc3BsaWNlKGksIDEpO1xuICAgICAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKCk7XG4gICAgfVxuXG4gICAgY2hlY2soYXV0aCkge1xuICAgICAgICBjb25zdCB7IGNoaWxkcmVuOiB7IGNoZWNrIH0gPSB7fSB9ID0gY29ubmVjdGlvbi5jb250ZXh0O1xuICAgICAgICByZXR1cm4gY2hlY2soYXV0aCk7XG4gICAgfVxufVxuXG4vL2NsYXNzIEJ1c0VtaXR0ZXIge1xuLy9cbi8vfVxuLy9cbi8vY2xhc3MgQnVzT2JqZWN0IHtcbi8vICAgIGNvbnN0cnVjdG9yIChidXMpIHtcbi8vICAgICAgICB0aGlzLmJ1cyA9IGJ1c1xuLy8gICAgICAgIHRoaXMuX2VtaXR0ZXIgPSBuZXcgQnVzRW1pdHRlcigpXG4vLyAgICB9XG4vL1xuLy8gICAgZ2V0IGVtaXR0ZXIgKCkge3JldHVybiB0aGlzLl9lbWl0dGVyfVxuLy99XG5cbnZhciBtYW5hZ2VyID0gbmV3IE1hbmFnZXIoKTtcblxuY29uc3QgbG9nUmVxdWVzdCA9IHJlcSA9PiBsb2ckJDEoYCAgJHtyZXEuaWR9LT4gJHtyZXEucGF0aH0ke3JlcS5pbnRmfS4ke3JlcS5tZW1iZXJ9KGAsIC4uLnJlcS5hcmdzLCBgKSBmcm9tICR7cmVxLnNlbmRlcn1gKTtcbmNvbnN0IGxvZ1Jlc3BvbnNlID0gKHJlcSwgcmVzKSA9PiByZXMuaGFzT3duUHJvcGVydHkoJ2VycicpID8gZXJyb3IkJDEoYDwtJHtyZXEuaWR9ICBgLCByZXMuZXJyLCAnRkFJTEVEJykgOiBsb2ckJDEoYDwtJHtyZXEuaWR9ICBgLCByZXMucmVzKTtcbmNsYXNzIE5vZGUge1xuICAgIGNvbnN0cnVjdG9yKCkge1xuICAgICAgICB0aGlzLmNvbm5zID0gW3VuZGVmaW5lZF07XG4gICAgICAgIHRoaXMub2JqZWN0cyA9IHt9O1xuICAgICAgICB0aGlzLnJlcWlkID0gMDtcbiAgICAgICAgdGhpcy5yZXF1ZXN0cyA9IHt9O1xuICAgICAgICB0aGlzLnNpZ25hbHMgPSBuZXcgRXZlbnRFbWl0dGVyKCk7XG4gICAgICAgIHRoaXMuc3RhdHVzID0gbmV3IEV2ZW50RW1pdHRlcigpO1xuICAgIH1cblxuICAgIGluaXQobmFtZSwgcGFyZW50KSB7XG4gICAgICAgIGxvZyQkMSgnbm9kZS5pbml0JywgbmFtZSk7XG4gICAgICAgIGlmIChwYXJlbnQpIHtcbiAgICAgICAgICAgIHBhcmVudC5pZCA9IDA7XG4gICAgICAgICAgICBwYXJlbnQucmVnaXN0ZXJlZCA9IHRydWU7XG4gICAgICAgICAgICB0aGlzLmNvbm5zWzBdID0gdGhpcy5iaW5kKHBhcmVudCk7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5uYW1lID0gbmFtZTtcbiAgICAgICAgdGhpcy5yb290ID0gbmFtZSA9PT0gJy8nO1xuICAgICAgICBtYW5hZ2VyLmluaXQobmFtZSk7XG5cbiAgICAgICAgaWYgKCF0aGlzLnNlcnZlciAmJiBjb25uZWN0aW9uLmhhc0NoaWxkcmVuKSB7XG4gICAgICAgICAgICBjb25uZWN0aW9uLmNyZWF0ZVNlcnZlcigpLnRoZW4oc2VydmVyID0+IHtcbiAgICAgICAgICAgICAgICB0aGlzLnNlcnZlciA9IHNlcnZlci5vbignY2hpbGQnLCBjb25uID0+IHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5hZGRDaGlsZCh0aGlzLmJpbmQoY29ubikpO1xuICAgICAgICAgICAgICAgIH0pLm9uKCdlcnJvcicsIGVyciA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGVycm9yJCQxKCdzZXJ2ZXIgZXJyb3InLCBlcnIubWVzc2FnZSk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGFkZENoaWxkKGNvbm4pIHtcbiAgICAgICAgY29ubi5pZCA9IHRoaXMuY29ubnMubGVuZ3RoO1xuICAgICAgICBjb25uLm5hbWUgPSBgJHt0aGlzLm5hbWV9JHtjb25uLmlkfWA7XG4gICAgICAgIGxvZyQkMShgJHt0aGlzLm5hbWV9IGFkZGluZyBjaGlsZCAke2Nvbm4ubmFtZX1gKTtcbiAgICAgICAgY29ubi5oZWxsbygpO1xuICAgICAgICB0aGlzLmNvbm5zLnB1c2goY29ubik7XG4gICAgICAgIGNvbm4ucmVnaXN0ZXJlZCA9IHRydWU7XG4gICAgfVxuXG4gICAgcm91dGUobikge1xuICAgICAgICBsZXQgaSA9IG4ubGFzdEluZGV4T2YoJy8nKTtcbiAgICAgICAgaWYgKGkgPT09IC0xKSB0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgbmFtZScpO1xuICAgICAgICBsZXQgcGF0aCA9IG4uc2xpY2UoMCwgaSArIDEpLFxuICAgICAgICAgICAgciA9IHBhdGggPT09IHRoaXMubmFtZSA/IG51bGwgOiBwYXRoLnN0YXJ0c1dpdGgodGhpcy5uYW1lKSA/IHRoaXMuY29ubnNbcGFyc2VJbnQocGF0aC5zbGljZSh0aGlzLm5hbWUubGVuZ3RoKSldIDogdGhpcy5jb25uc1swXTtcbiAgICAgICAgLy9sb2coYHJvdXRpbmcgdG8gJHtwYXRofSBmcm9tICR7dGhpcy5uYW1lfSByZXR1cm5zICR7ciAmJiByLm5hbWV9YClcbiAgICAgICAgcmV0dXJuIHI7XG4gICAgfVxuXG4gICAgYmluZChjb25uKSB7XG4gICAgICAgIHJldHVybiBjb25uLm9uKCdkYXRhJywgZGF0YSA9PiB7XG4gICAgICAgICAgICAvL2xvZyhgZGF0YSBmcm9tICR7Y29ubi5uYW1lfWAsIGRhdGEpXG4gICAgICAgICAgICBpZiAoZGF0YS5yZXEpIHRoaXMuX3JlcXVlc3QoZGF0YS5yZXEpO2Vsc2UgaWYgKGRhdGEucmVzKSB0aGlzLnJlc3BvbnNlKGRhdGEucmVzKTtlbHNlIGlmIChkYXRhLnNpZykgdGhpcy5zaWduYWwoZGF0YS5zaWcsIGNvbm4uaWQpO1xuICAgICAgICB9KS5vbignY2xvc2UnLCAoKSA9PiB7XG4gICAgICAgICAgICBsb2ckJDEoYGNvbm5lY3Rpb24gY2xvc2UgJHtjb25uLm5hbWV9YCk7XG4gICAgICAgICAgICBpZiAoIWNvbm4ucmVnaXN0ZXJlZCkge1xuICAgICAgICAgICAgICAgIGxvZyQkMSgnY29ubmVjdGlvbiB3YXMgbm90IHJlZ2lzdGVyZWQnKTtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aGlzLmNvbm5zW2Nvbm4uaWRdID0gdW5kZWZpbmVkO1xuICAgICAgICAgICAgaWYgKGNvbm4uaWQgPT09IDApIHRoaXMucmVjb25uZWN0KCk7ZWxzZSBQcm9taXNlLnJlc29sdmUoKS50aGVuKCgpID0+IG1hbmFnZXIucmVtb3ZlTm9kZShgJHtjb25uLm5hbWV9L2ApKS50aGVuKCgpID0+IGxvZyQkMShgY29ubmVjdGlvbiByZW1vdmVkICR7Y29ubi5uYW1lfWApKS5jYXRjaChlID0+IGxvZyQkMSgnbWFuYWdlci5yZW1vdmVOb2RlIHJlamVjdGVkJywgZSkpO1xuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICByZWNvbm5lY3QobXMgPSAxMDAwKSB7XG4gICAgICAgIHRoaXMuc3RhdHVzLmVtaXQoJ2Rpc2Nvbm5lY3QnKTtcbiAgICAgICAgc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICAgICAgICBjb25zdCBjb25uID0gY29ubmVjdGlvbi5jcmVhdGVQYXJlbnRDb25uZWN0aW9uKCkub24oJ29wZW4nLCAoKSA9PiB7XG4gICAgICAgICAgICAgICAgbG9nJCQxKCdyZWNvbm5lY3QgcGFyZW50IG9wZW4nKTtcbiAgICAgICAgICAgIH0pLm9uKCdjbG9zZScsICgpID0+IHtcbiAgICAgICAgICAgICAgICBsb2ckJDEoJ3JlY29ubmVjdCBwYXJlbnQgY2xvc2UnKTtcbiAgICAgICAgICAgIH0pLm9uKCdjb25uZWN0JywgbmFtZSA9PiB7XG4gICAgICAgICAgICAgICAgdGhpcy5pbml0KG5hbWUsIGNvbm4pO1xuICAgICAgICAgICAgICAgIE9iamVjdC5rZXlzKHRoaXMub2JqZWN0cykuZm9yRWFjaChuYW1lID0+IG1hbmFnZXIuYWRkTmFtZShuYW1lLCB0aGlzLm5hbWUpKTtcbiAgICAgICAgICAgICAgICB0aGlzLnN0YXR1cy5lbWl0KCdyZWNvbm5lY3QnKTtcbiAgICAgICAgICAgIH0pLm9uKCdlcnJvcicsIGVyciA9PiB7XG4gICAgICAgICAgICAgICAgZXJyb3IkJDEoJ3JlY29ubmVjdCBwYXJlbnQgZXJyb3InLCBlcnIubWVzc2FnZSk7XG4gICAgICAgICAgICAgICAgdGhpcy5yZWNvbm5lY3QoTWF0aC5taW4obXMgKiAyLCAzMjAwMCkpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0sIG1zKTtcbiAgICB9XG5cbiAgICByZXF1ZXN0KHJlcSkge1xuICAgICAgICByZXR1cm4gbmV3IFByb21pc2UoKHIsIGopID0+IHtcbiAgICAgICAgICAgIHJlcS5zZW5kZXIgPSB0aGlzLm5hbWU7XG4gICAgICAgICAgICByZXEuaWQgPSB0aGlzLnJlcWlkKys7XG4gICAgICAgICAgICB0aGlzLnJlcXVlc3RzW3JlcS5pZF0gPSB7IHIsIGosIHJlcSB9O1xuICAgICAgICAgICAgdGhpcy5fcmVxdWVzdChyZXEpO1xuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICBfcmVxdWVzdChyZXEpIHtcbiAgICAgICAgbG9nUmVxdWVzdChyZXEpO1xuICAgICAgICBjb25zdCBjb25uID0gdGhpcy5yb3V0ZShyZXEucGF0aCk7XG4gICAgICAgIGlmIChjb25uKSB7XG4gICAgICAgICAgICBjb25uLnNlbmQoeyByZXEgfSk7XG4gICAgICAgIH0gZWxzZSBpZiAoY29ubiA9PT0gbnVsbCkge1xuICAgICAgICAgICAgUHJvbWlzZS5yZXNvbHZlKCkudGhlbigoKSA9PiB7XG4gICAgICAgICAgICAgICAgY29uc3QgeyBpbnRmLCBtZW1iZXIsIHNlbmRlciB9ID0gcmVxLFxuICAgICAgICAgICAgICAgICAgICAgIGluZm8gPSB0aGlzLm9iamVjdHNbaW50Zl07XG4gICAgICAgICAgICAgICAgaWYgKCFpbmZvKSB0aHJvdyBgRXJyb3IgaW50ZXJmYWNlICR7aW50Zn0gb2JqZWN0IG5vdCBmb3VuZGA7XG4gICAgICAgICAgICAgICAgY29uc3QgeyBvYmosIG1ldGEgPSB7fSB9ID0gaW5mbztcbiAgICAgICAgICAgICAgICBpZiAoIW9ialttZW1iZXJdKSB0aHJvdyBgRXJyb3IgbWVtYmVyICR7bWVtYmVyfSBub3QgZm91bmRgO1xuICAgICAgICAgICAgICAgIGxldCB7IGFyZ3MgfSA9IHJlcTtcbiAgICAgICAgICAgICAgICBpZiAobWV0YS5zZW5kZXIpIGFyZ3MgPSBhcmdzLmNvbmNhdChzZW5kZXIpO1xuICAgICAgICAgICAgICAgIHJldHVybiBvYmpbbWVtYmVyXSguLi5hcmdzKTtcbiAgICAgICAgICAgIH0pLnRoZW4ocmVzID0+IHRoaXMucmVzcG9uc2UoeyBpZDogcmVxLmlkLCBwYXRoOiByZXEuc2VuZGVyLCByZXMgfSksIGVyciA9PiB0aGlzLnJlc3BvbnNlKHsgaWQ6IHJlcS5pZCwgcGF0aDogcmVxLnNlbmRlciwgZXJyIH0pKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGxvZyQkMSgnX3JlcXVlc3QgY29ubmVjdGlvbiBlcnJvcicsIHJlcSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZXNwb25zZShyZXMpIHtcbiAgICAgICAgY29uc3QgY29ubiA9IHRoaXMucm91dGUocmVzLnBhdGgpO1xuICAgICAgICBpZiAoY29ubikgY29ubi5zZW5kKHsgcmVzIH0pO2Vsc2UgaWYgKGNvbm4gPT09IG51bGwpIHtcbiAgICAgICAgICAgIGxldCB7IHIsIGosIHJlcSB9ID0gdGhpcy5yZXF1ZXN0c1tyZXMuaWRdO1xuICAgICAgICAgICAgZGVsZXRlIHRoaXMucmVxdWVzdHNbcmVzLmlkXTtcbiAgICAgICAgICAgIGxvZ1Jlc3BvbnNlKHJlcSwgcmVzKTtcbiAgICAgICAgICAgIGlmIChyZXMuaGFzT3duUHJvcGVydHkoJ2VycicpKSBqKHJlcy5lcnIpO2Vsc2UgcihyZXMucmVzKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGVycm9yJCQxKCdjb25uZWN0aW9uIGVycm9yJywgcmVzKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHNpZ25hbChzaWcsIGZyb20pIHtcbiAgICAgICAgdGhpcy5zaWduYWxzLmVtaXQoc2lnLm5hbWUsIHNpZy5hcmdzKTtcbiAgICAgICAgdGhpcy5jb25ucy5maWx0ZXIoYyA9PiBjICYmIGMuaWQgIT09IGZyb20pLmZvckVhY2goYyA9PiB7XG4gICAgICAgICAgICAvL2xvZyhgc2lncm91dGluZyAke25hbWV9IGZyb20gJHtmcm9tfSB0byAke2MuaWR9YClcbiAgICAgICAgICAgIGMgJiYgYy5zZW5kKHsgc2lnIH0pO1xuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICBjbG9zZSgpIHt9XG5cbiAgICByZWdpc3Rlck9iamVjdChuYW1lLCBvYmosIGludGYsIG1ldGEpIHtcbiAgICAgICAgbG9nJCQxKGByZWdpc3Rlck9iamVjdCAke25hbWV9IGF0ICR7dGhpcy5uYW1lfSBpbnRlcmZhY2VgLCBpbnRmKTtcbiAgICAgICAgdGhpcy5vYmplY3RzW25hbWVdID0geyBvYmosIGludGYsIG1ldGEgfTtcbiAgICB9XG5cbiAgICB1bnJlZ2lzdGVyT2JqZWN0KG5hbWUpIHtcbiAgICAgICAgbG9nJCQxKGB1blJlZ2lzdGVyT2JqZWN0ICR7bmFtZX0gYXQgJHt0aGlzLm5hbWV9YCk7XG4gICAgICAgIGRlbGV0ZSB0aGlzLm9iamVjdHNbbmFtZV07XG4gICAgfVxufVxuXG52YXIgbm9kZSA9IG5ldyBOb2RlKCk7XG5cbmZ1bmN0aW9uIGV4ZWN1dG9yKF9yLCBfaikge1xuICAgIHJldHVybiB7XG4gICAgICAgIHByb21pc2U6IG5ldyBQcm9taXNlKChyLCBqKSA9PiB7XG4gICAgICAgICAgICBfciA9IHI7X2ogPSBqO1xuICAgICAgICB9KSxcbiAgICAgICAgcmVzb2x2ZTogdiA9PiBfcih2KSxcbiAgICAgICAgcmVqZWN0OiBlID0+IF9qKGUpXG4gICAgfTtcbn1cblxubGV0IHN0YXJ0ID0gZXhlY3V0b3IoKTtcblxuY2xhc3MgQnVzIHtcbiAgICBzdGFydChjb250ZXh0KSB7XG4gICAgICAgIGlmICghc3RhcnQuc3RhcnRlZCkge1xuICAgICAgICAgICAgc3RhcnQuc3RhcnRlZCA9IHRydWU7XG4gICAgICAgICAgICBjb25uZWN0aW9uLmNyZWF0ZShjb250ZXh0KS50aGVuKCgpID0+IHtcbiAgICAgICAgICAgICAgICBpZiAoY29ubmVjdGlvbi5oYXNQYXJlbnQpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgY29ubiA9IGNvbm5lY3Rpb24uY3JlYXRlUGFyZW50Q29ubmVjdGlvbigpLm9uKCdvcGVuJywgKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgLy9sb2coJ3BhcmVudCBvcGVuJylcbiAgICAgICAgICAgICAgICAgICAgfSkub24oJ2Nsb3NlJywgKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgbG9nJCQxKCdwYXJlbnQgY2xvc2UnKTtcbiAgICAgICAgICAgICAgICAgICAgfSkub24oJ2Nvbm5lY3QnLCBuYW1lID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIG5vZGUuaW5pdChuYW1lLCBjb25uKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHN0YXJ0LnJlc29sdmUodGhpcyk7XG4gICAgICAgICAgICAgICAgICAgIH0pLm9uKCdlcnJvcicsIGVyciA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBlcnJvciQkMSgncGFyZW50IGVycm9yJywgZXJyKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHN0YXJ0LnJlamVjdChlcnIpO1xuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBub2RlLmluaXQoJy8nKTtcbiAgICAgICAgICAgICAgICAgICAgc3RhcnQucmVzb2x2ZSh0aGlzKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gc3RhcnQucHJvbWlzZTtcbiAgICB9XG5cbiAgICBzdGFydGVkKCkge1xuICAgICAgICByZXR1cm4gc3RhcnQucHJvbWlzZTtcbiAgICB9XG5cbiAgICBnZXQgcm9vdCgpIHtcbiAgICAgICAgcmV0dXJuIG5vZGUucm9vdDtcbiAgICB9XG5cbiAgICBnZXQgbmFtZSgpIHtcbiAgICAgICAgcmV0dXJuIG5vZGUubmFtZTtcbiAgICB9XG5cbiAgICBnZXQgcHJveHkoKSB7XG4gICAgICAgIHJldHVybiBwcm94eTtcbiAgICB9XG5cbiAgICByZWdpc3Rlck9iamVjdChuYW1lLCBvYmosIGludGYgPSBtZXRob2RzKG9iaikpIHtcbiAgICAgICAgcmV0dXJuIG1hbmFnZXIuYWRkTmFtZShuYW1lLCB0aGlzLm5hbWUpLnRoZW4oKCkgPT4gbm9kZS5yZWdpc3Rlck9iamVjdChuYW1lLCBvYmosIGludGYpKS50aGVuKCgpID0+ICh7XG4gICAgICAgICAgICBzaWduYWw6IChtZW1iZXIsIGFyZ3MpID0+IG5vZGUuc2lnbmFsKHsgbmFtZTogYCR7bmFtZX0uJHttZW1iZXJ9YCwgYXJncyB9KVxuICAgICAgICB9KSk7XG4gICAgfVxuXG4gICAgdW5yZWdpc3Rlck9iamVjdChuYW1lKSB7XG4gICAgICAgIHJldHVybiBtYW5hZ2VyLnJlbW92ZU5hbWUobmFtZSwgdGhpcy5uYW1lKS50aGVuKCgpID0+IG5vZGUudW5yZWdpc3Rlck9iamVjdChuYW1lKSk7XG4gICAgfVxuXG4gICAgcmVxdWVzdChuYW1lLCAuLi5hcmdzKSB7XG4gICAgICAgIGxvZyQkMSgncmVxdWVzdCcsIG5hbWUsIGFyZ3MpO1xuICAgICAgICBjb25zdCBbLCBwYXRoLCBpbnRmLCBtZW1iZXJdID0gL14oWy9cXGRdKykoXFx3KykuKFxcdyspJC8uZXhlYyhuYW1lKTtcbiAgICAgICAgcmV0dXJuIG5vZGUucmVxdWVzdCh7IHBhdGgsIGludGYsIG1lbWJlciwgYXJncyB9KS5jYXRjaChlID0+IHtcbiAgICAgICAgICAgIGVycm9yJCQxKGByZXF1ZXN0ICR7bmFtZX0gcmVqZWN0ZWQgJHtlfWApO1xuICAgICAgICAgICAgdGhyb3cgZTtcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgc2lnbmFsKG5hbWUsIGFyZ3MpIHtcbiAgICAgICAgdGhyb3cgJ2RlcHJlY2F0ZWQnO1xuICAgICAgICAvL2xvZygnc2lnbmFsJywgbmFtZSwgYXJncylcbiAgICAgICAgLy9jb25zdCBbLCBwYXRoLCBpbnRmLCBtZW1iZXJdID0gL14oWy9cXGRdKykoXFx3KykuKFxcdyspJC8uZXhlYyhuYW1lKVxuICAgICAgICAvL3JldHVybiBub2RlLnNpZ25hbCh7bmFtZSwgcGF0aCwgaW50ZiwgbWVtYmVyLCBhcmdzfSlcbiAgICB9XG5cbiAgICByZWdpc3Rlckxpc3RlbmVyKG5hbWUsIGNiKSB7XG4gICAgICAgIC8vY29uc3QgWywgcGF0aCwgaW50ZiwgbWVtYmVyXSA9IC9eKFsvXFxkXSspKFxcdyspLihcXHcrKSQvLmV4ZWMobmFtZSlcbiAgICAgICAgLy9UT0RPXG4gICAgICAgIG5vZGUuc2lnbmFscy5vbihuYW1lLCBjYik7XG4gICAgfVxuXG4gICAgdW5yZWdpc3Rlckxpc3RlbmVyKG5hbWUsIGNiKSB7XG4gICAgICAgIC8vVE9ET1xuICAgICAgICBub2RlLnNpZ25hbHMub2ZmKG5hbWUsIGNiKTtcbiAgICB9XG5cbiAgICBvbih0eXBlLCBjYikge1xuICAgICAgICBub2RlLnN0YXR1cy5vbih0eXBlLCBjYik7XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cblxuICAgIG9mZih0eXBlLCBjYikge1xuICAgICAgICBub2RlLnN0YXR1cy5vZmYodHlwZSwgY2IpO1xuICAgIH1cblxuICAgIGNsb3NlKCkge1xuICAgICAgICBub2RlLmNsb3NlKCk7XG4gICAgfVxufVxuXG52YXIgYnVzID0gbmV3IEJ1cygpO1xuXG5leHBvcnQgeyBidXMsIHByb3h5LCBFdmVudEVtaXR0ZXIsIG1peGluRXZlbnRFbWl0dGVyLCBleGVjdXRvciwgbG9nJDEgYXMgbG9nLCBlcnJvciQxIGFzIGVycm9yIH07ZXhwb3J0IGRlZmF1bHQgYnVzO1xuLy8jIHNvdXJjZU1hcHBpbmdVUkw9YnVzLmJyb3dzZXIuZXMuanMubWFwXG4iLCIvKlxuIENvcHlyaWdodCAoQykgMjAxNi0yMDE3IFRoZWF0ZXJzb2Z0XG5cbiBUaGlzIHByb2dyYW0gaXMgZnJlZSBzb2Z0d2FyZTogeW91IGNhbiByZWRpc3RyaWJ1dGUgaXQgYW5kL29yIG1vZGlmeSBpdCB1bmRlclxuIHRoZSB0ZXJtcyBvZiB0aGUgR05VIEFmZmVybyBHZW5lcmFsIFB1YmxpYyBMaWNlbnNlIGFzIHB1Ymxpc2hlZCBieSB0aGUgRnJlZVxuIFNvZnR3YXJlIEZvdW5kYXRpb24sIHZlcnNpb24gMy5cblxuIFRoaXMgcHJvZ3JhbSBpcyBkaXN0cmlidXRlZCBpbiB0aGUgaG9wZSB0aGF0IGl0IHdpbGwgYmUgdXNlZnVsLCBidXQgV0lUSE9VVFxuIEFOWSBXQVJSQU5UWTsgd2l0aG91dCBldmVuIHRoZSBpbXBsaWVkIHdhcnJhbnR5IG9mIE1FUkNIQU5UQUJJTElUWSBvciBGSVRORVNTXG4gRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFLiBTZWUgdGhlIEdOVSBBZmZlcm8gR2VuZXJhbCBQdWJsaWMgTGljZW5zZSBmb3IgbW9yZVxuIGRldGFpbHMuXG5cbiBZb3Ugc2hvdWxkIGhhdmUgcmVjZWl2ZWQgYSBjb3B5IG9mIHRoZSBHTlUgQWZmZXJvIEdlbmVyYWwgUHVibGljIExpY2Vuc2UgYWxvbmdcbiB3aXRoIHRoaXMgcHJvZ3JhbS4gSWYgbm90LCBzZWUgPGh0dHA6Ly93d3cuZ251Lm9yZy9saWNlbnNlcy8+XG4gKi9cbmltcG9ydCB7IENvbXBvbmVudCwgaCB9IGZyb20gJ3ByZWFjdCc7XG5pbXBvcnQgeyBtaXhpbkV2ZW50RW1pdHRlciB9IGZyb20gJ0B0aGVhdGVyc29mdC9idXMnO1xuXG5jb25zdCBUZXh0PSh7dGV4dDphLGlkOmJ9KT0+aCgnZGl2Jyx7J2NsYXNzJzondGV4dCcsaWQ6Yn0saCgnc3BhbicsbnVsbCxhKSk7Y29uc3QgY29sPWE9PmgoJ2RpdicseydjbGFzcyc6J2NvbCd9LGEpO2NvbnN0IGNvbHM9YT0+YS5tYXAoYj0+Y29sKGIpKTtjb25zdCByb3c9YT0+aCgnZGl2Jyx7J2NsYXNzJzoncm93J30sYSk7Y29uc3Qgcm93cz1hPT5hLm1hcChiPT5oKCdkaXYnLHsnY2xhc3MnOidyb3cnfSxiKSk7Y29uc3QgZ3JpZD1hPT5hLm1hcChiPT5oKCdkaXYnLHsnY2xhc3MnOidyb3cnfSxjb2xzKGIpKSk7Y29uc3QgUm93PSh7Y2hpbGRyZW46YX0pPT5oKCdkaXYnLHsnY2xhc3MnOidyb3cnfSxhKTtjb25zdCBDb2w9KHtjaGlsZHJlbjphfSk9PmgoJ2RpdicseydjbGFzcyc6J2NvbCd9LGEpO2NvbnN0IFJvd0NvbHM9KHtjaGlsZHJlbjphfSk9PmgoJ2RpdicseydjbGFzcyc6J3Jvdyd9LGNvbHMoYSkpO2NvbnN0IENvbFJvd3M9KHtjaGlsZHJlbjphfSk9PmgoJ2RpdicseydjbGFzcyc6J2NvbCd9LHJvd3MoYSkpO1xuXG5mdW5jdGlvbiBjbGFzc2VzKC4uLmEpe2NvbnN0IGI9W107Zm9yKGNvbnN0IGMgb2YgYSlpZighYyljb250aW51ZTtlbHNlIGlmKCdzdHJpbmcnPT10eXBlb2YgYyliLnB1c2goYyk7ZWxzZSBpZignb2JqZWN0Jz09dHlwZW9mIGMpZm9yKGNvbnN0W2QsZV1vZiBPYmplY3QuZW50cmllcyhjKSlpZihlKWIucHVzaChkKTtyZXR1cm4gYi5qb2luKCcgJyl9XG5cbmNsYXNzIEljb24gZXh0ZW5kcyBDb21wb25lbnR7cmVuZGVyKGEpe2NvbnN0e2ljb246YixzbWFsbDpjLGNiOmR9PWE7cmV0dXJuIGgoJ3NwYW4nLHsnY2xhc3MnOmNsYXNzZXMoJ2ljb24nLGEuY2xhc3MsYyYmJ3NtYWxsJyksb25DbGljazpkfSxoKCdzdmcnLHtpZDpgaWNvbi0ke2J9YH0saCgndXNlJyx7aHJlZjpgI3N2Zy0ke2J9YH0pKSl9fVxuXG52YXIgc3R5bGUgPSB7ZmxhdDpcIl9mbGF0XzFyNGdtXzFcIixyYWlzZWQ6XCJfcmFpc2VkXzFyNGdtXzE4XCIsaW52ZXJzZTpcIl9pbnZlcnNlXzFyNGdtXzQxXCIsZmxvYXRpbmc6XCJfZmxvYXRpbmdfMXI0Z21fNTBcIixpY29uOlwiX2ljb25fMXI0Z21fODJcIixtaW5pOlwiX21pbmlfMXI0Z21fODVcIixuZXV0cmFsOlwiX25ldXRyYWxfMXI0Z21fOTJcIixwcmltYXJ5OlwiX3ByaW1hcnlfMXI0Z21fMTE1XCIsYWNjZW50OlwiX2FjY2VudF8xcjRnbV8xMjlcIn07XG5cbnZhciBzdHlsZSQxID0ge3JpcHBsZVdyYXBwZXI6XCJfcmlwcGxlV3JhcHBlcl92cjB3NV8xXCIscmlwcGxlOlwiX3JpcHBsZV92cjB3NV8xXCIscmlwcGxlUmVzdGFydGluZzpcIl9yaXBwbGVSZXN0YXJ0aW5nX3ZyMHc1XzIxXCIscmlwcGxlQWN0aXZlOlwiX3JpcHBsZUFjdGl2ZV92cjB3NV8yNVwifTtcblxudmFyIF9leHRlbmRzID0gT2JqZWN0LmFzc2lnbiB8fCBmdW5jdGlvbiAodGFyZ2V0KSB7XG4gIGZvciAodmFyIGkgPSAxOyBpIDwgYXJndW1lbnRzLmxlbmd0aDsgaSsrKSB7XG4gICAgdmFyIHNvdXJjZSA9IGFyZ3VtZW50c1tpXTtcblxuICAgIGZvciAodmFyIGtleSBpbiBzb3VyY2UpIHtcbiAgICAgIGlmIChPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwoc291cmNlLCBrZXkpKSB7XG4gICAgICAgIHRhcmdldFtrZXldID0gc291cmNlW2tleV07XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHRhcmdldDtcbn07XG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cbnZhciBvYmplY3RXaXRob3V0UHJvcGVydGllcyA9IGZ1bmN0aW9uIChvYmosIGtleXMpIHtcbiAgdmFyIHRhcmdldCA9IHt9O1xuXG4gIGZvciAodmFyIGkgaW4gb2JqKSB7XG4gICAgaWYgKGtleXMuaW5kZXhPZihpKSA+PSAwKSBjb250aW51ZTtcbiAgICBpZiAoIU9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChvYmosIGkpKSBjb250aW51ZTtcbiAgICB0YXJnZXRbaV0gPSBvYmpbaV07XG4gIH1cblxuICByZXR1cm4gdGFyZ2V0O1xufTtcblxuY29uc3QgbW91c2VQb3NpdGlvbj1hPT5bYS5wYWdlWC0od2luZG93LnNjcm9sbFh8fHdpbmRvdy5wYWdlWE9mZnNldCksYS5wYWdlWS0od2luZG93LnNjcm9sbFl8fHdpbmRvdy5wYWdlWU9mZnNldCldOyBjb25zdCB0b3VjaFBvc2l0aW9uPWE9PlthLnRvdWNoZXNbMF0ucGFnZVgtKHdpbmRvdy5zY3JvbGxYfHx3aW5kb3cucGFnZVhPZmZzZXQpLGEudG91Y2hlc1swXS5wYWdlWS0od2luZG93LnNjcm9sbFl8fHdpbmRvdy5wYWdlWU9mZnNldCldO3ZhciByaXBwbGVGYWN0b3J5ID0gKChfcmVmKT0+e2xldHtjZW50ZXJlZDpiPSExLGNsYXNzOmM9JycsbXVsdGlwbGU6ZD0hMCxzcHJlYWQ6Zj0yfT1fcmVmLGE9b2JqZWN0V2l0aG91dFByb3BlcnRpZXMoX3JlZixbJ2NlbnRlcmVkJywnY2xhc3MnLCdtdWx0aXBsZScsJ3NwcmVhZCddKTtyZXR1cm4gZz0+e3ZhciBfY2xhc3MyLF90ZW1wO3JldHVybiBfdGVtcD1fY2xhc3MyPWNsYXNzIGV4dGVuZHMgQ29tcG9uZW50e2NvbnN0cnVjdG9yKCl7c3VwZXIoKTt0aGlzLnN0YXRlPXtyaXBwbGVzOnt9fTt0aGlzLnJpcHBsZU5vZGVzPXt9O3RoaXMuY3VycmVudENvdW50PTA7fWNvbXBvbmVudERpZFVwZGF0ZShpLGope2lmKE9iamVjdC5rZXlzKGoucmlwcGxlcykubGVuZ3RoPE9iamVjdC5rZXlzKHRoaXMuc3RhdGUucmlwcGxlcykubGVuZ3RoKXRoaXMuYWRkUmlwcGxlUmVtb3ZlRXZlbnRMaXN0ZW5lcih0aGlzLmN1cnJlbnRLZXkpO31jb21wb25lbnRXaWxsVW5tb3VudCgpe09iamVjdC52YWx1ZXModGhpcy5zdGF0ZS5yaXBwbGVzKS5mb3JFYWNoKGk9PmkuZW5kUmlwcGxlKCkpO31hbmltYXRlUmlwcGxlKGksaixsKXtjb25zdCBtPSgpPT50aGlzLmN1cnJlbnRLZXk9YHJpcHBsZSR7Kyt0aGlzLmN1cnJlbnRDb3VudH1gLG49cD0+e2NvbnN0IHE9cHx8IXRoaXMudG91Y2hDYWNoZTt0aGlzLnRvdWNoQ2FjaGU9cDtyZXR1cm4gcX0sbz0ocCxxKT0+e2NvbnN0e2xlZnQ6cix0b3A6cyxoZWlnaHQ6dCx3aWR0aDp1fT10aGlzLmJhc2UuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCkse3JpcHBsZUNlbnRlcmVkOncscmlwcGxlU3ByZWFkOnp9PXRoaXMucHJvcHM7cmV0dXJue2xlZnQ6dz8wOnAtci11LzIsdG9wOnc/MDpxLXMtdC8yLHdpZHRoOnUqen19O2lmKG4obCkpe2NvbnN0e3RvcDpwLGxlZnQ6cSx3aWR0aDpyfT1vKGksaikscz0wPT09T2JqZWN0LmtleXModGhpcy5zdGF0ZS5yaXBwbGVzKS5sZW5ndGgsdD10aGlzLnByb3BzLnJpcHBsZU11bHRpcGxlfHxzP20oKTp0aGlzLmN1cnJlbnRLZXksdT10aGlzLmFkZFJpcHBsZURlYWN0aXZhdGVFdmVudExpc3RlbmVyKGwsdCksdz17YWN0aXZlOiExLHJlc3RhcnRpbmc6ITAsdG9wOnAsbGVmdDpxLHdpZHRoOnIsZW5kUmlwcGxlOnV9LHo9e2FjdGl2ZTohMCxyZXN0YXJ0aW5nOiExfSxBPU9iamVjdC5hc3NpZ24oe30sdGhpcy5zdGF0ZS5yaXBwbGVzLHtbdF06d30pO3RoaXMuc2V0U3RhdGUoe3JpcHBsZXM6QX0sKCk9Pnt0aGlzLnNldFN0YXRlKHtyaXBwbGVzOk9iamVjdC5hc3NpZ24oe30sdGhpcy5zdGF0ZS5yaXBwbGVzLHtbdF06T2JqZWN0LmFzc2lnbih7fSx0aGlzLnN0YXRlLnJpcHBsZXNbdF0seil9KX0pO30pO319YWRkUmlwcGxlUmVtb3ZlRXZlbnRMaXN0ZW5lcihpKXtjb25zdCBqPXRoaXMucmlwcGxlTm9kZXNbaV0sbD1tPT57aWYoJ29wYWNpdHknPT09bS5wcm9wZXJ0eU5hbWUpe2lmKHRoaXMucHJvcHMub25SaXBwbGVFbmRlZCl0aGlzLnByb3BzLm9uUmlwcGxlRW5kZWQobSk7ai5yZW1vdmVFdmVudExpc3RlbmVyKCd0cmFuc2l0aW9uZW5kJyxsKTtkZWxldGUgdGhpcy5yaXBwbGVOb2Rlc1tpXTtjb25zdCBfc3RhdGUkcmlwcGxlcz10aGlzLnN0YXRlLnJpcHBsZXMse1tpXTpufT1fc3RhdGUkcmlwcGxlcyxvPW9iamVjdFdpdGhvdXRQcm9wZXJ0aWVzKF9zdGF0ZSRyaXBwbGVzLFtpXSk7dGhpcy5zZXRTdGF0ZSh7cmlwcGxlczpvfSk7fX07ai5hZGRFdmVudExpc3RlbmVyKCd0cmFuc2l0aW9uZW5kJyxsKTt9YWRkUmlwcGxlRGVhY3RpdmF0ZUV2ZW50TGlzdGVuZXIoaSxqKXtjb25zdCBsPWk/J3RvdWNoZW5kJzonbW91c2V1cCcsbT0oKT0+e2RvY3VtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIobCxtKTt0aGlzLnNldFN0YXRlKHtyaXBwbGVzOk9iamVjdC5hc3NpZ24oe30sdGhpcy5zdGF0ZS5yaXBwbGVzLHtbal06T2JqZWN0LmFzc2lnbih7fSx0aGlzLnN0YXRlLnJpcHBsZXNbal0se2FjdGl2ZTohMX0pfSl9KTt9O2RvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIobCxtKTtyZXR1cm4gbX1yZW5kZXJSaXBwbGUoaSxqLHthY3RpdmU6bCxsZWZ0Om0scmVzdGFydGluZzpuLHRvcDpvLHdpZHRoOnB9KXtjb25zdCBxPWB0cmFuc2xhdGUzZCgkey1wLzIrbX1weCwgJHstcC8yK299cHgsIDApIHNjYWxlKCR7bj8wOjF9KWAscj17dHJhbnNmb3JtOnEsd2lkdGg6cCxoZWlnaHQ6cH0scz1jbGFzc2VzKHN0eWxlJDEucmlwcGxlLHtbc3R5bGUkMS5yaXBwbGVBY3RpdmVdOmwsW3N0eWxlJDEucmlwcGxlUmVzdGFydGluZ106bn0saik7Y29uc29sZS5sb2coJ3JlbmRlclJpcHBsZScsaSxzLHIsdGhpcy5yaXBwbGVOb2Rlc1tpXSk7cmV0dXJuIGgoJ3NwYW4nLF9leHRlbmRzKHtrZXk6aSwnY2xhc3MnOnN0eWxlJDEucmlwcGxlV3JhcHBlcn0sYSksaCgnc3BhbicseydjbGFzcyc6cyxyZWY6dD0+e2lmKHQpdGhpcy5yaXBwbGVOb2Rlc1tpXT10O30sc3R5bGU6cn0pKX1yZW5kZXIoX3JlZjIse3JpcHBsZXM6c30pe2xldHtyaXBwbGU6aSxyaXBwbGVDbGFzczpqLGRpc2FibGVkOmwsb25SaXBwbGVFbmRlZDptLHJpcHBsZUNlbnRlcmVkOm4scmlwcGxlTXVsdGlwbGU6byxyaXBwbGVTcHJlYWQ6cCxjaGlsZHJlbjpxfT1fcmVmMixyPW9iamVjdFdpdGhvdXRQcm9wZXJ0aWVzKF9yZWYyLFsncmlwcGxlJywncmlwcGxlQ2xhc3MnLCdkaXNhYmxlZCcsJ29uUmlwcGxlRW5kZWQnLCdyaXBwbGVDZW50ZXJlZCcsJ3JpcHBsZU11bHRpcGxlJywncmlwcGxlU3ByZWFkJywnY2hpbGRyZW4nXSk7Y29uc3QgdD0hbCYmaSx1PXo9PntpZih0aGlzLnByb3BzLm9uTW91c2VEb3duKXRoaXMucHJvcHMub25Nb3VzZURvd24oeik7aWYodCl0aGlzLmFuaW1hdGVSaXBwbGUoLi4ubW91c2VQb3NpdGlvbih6KSwhMSk7fSx3PXo9PntpZih0aGlzLnByb3BzLm9uVG91Y2hTdGFydCl0aGlzLnByb3BzLm9uVG91Y2hTdGFydCh6KTtpZih0KXRoaXMuYW5pbWF0ZVJpcHBsZSguLi50b3VjaFBvc2l0aW9uKHopLCEwKTt9O3JldHVybiBoKGcsT2JqZWN0LmFzc2lnbih7fSx0JiZ7b25Nb3VzZURvd246dSxvblRvdWNoU3RhcnQ6d30se2NoaWxkcmVuOnQ/cS5jb25jYXQoT2JqZWN0LmVudHJpZXMocykubWFwKChbeixBXSk9PnRoaXMucmVuZGVyUmlwcGxlKHosaixBKSkpOnEsZGlzYWJsZWQ6bH0scikpfX0sX2NsYXNzMi5kZWZhdWx0UHJvcHM9e2Rpc2FibGVkOiExLHJpcHBsZTohMCxyaXBwbGVDZW50ZXJlZDpiLHJpcHBsZUNsYXNzOmMscmlwcGxlTXVsdGlwbGU6ZCxyaXBwbGVTcHJlYWQ6Zn0sX3RlbXB9fSk7XG5cbnZhciBSaXBwbGUgPSAoYT0+cmlwcGxlRmFjdG9yeShhKSk7XG5cbmNvbnN0IEJ1dHRvbj1SaXBwbGUoe2NlbnRlcmVkOiExfSkoY2xhc3MgZXh0ZW5kcyBDb21wb25lbnR7cmVuZGVyKGEpe2NvbnN0e2FjY2VudDpnPSExLGRpc2FibGVkOmIsZmxvYXRpbmc6aT0hMSxpY29uOmMsaW52ZXJzZTpkLGxhYmVsOmUsbWluaTpqPSExLHByaW1hcnk6az0hMSxyYWlzZWQ6bD0hMX09YSxmPW9iamVjdFdpdGhvdXRQcm9wZXJ0aWVzKGEsWydhY2NlbnQnLCdkaXNhYmxlZCcsJ2Zsb2F0aW5nJywnaWNvbicsJ2ludmVyc2UnLCdsYWJlbCcsJ21pbmknLCdwcmltYXJ5JywncmFpc2VkJ10pO3JldHVybiBoKCdidXR0b24nLF9leHRlbmRzKHsnY2xhc3MnOmNsYXNzZXMoYS5jbGFzcyxrP3N0eWxlLnByaW1hcnk6Zz9zdHlsZS5hY2NlbnQ6c3R5bGUubmV1dHJhbCxsP3N0eWxlLnJhaXNlZDppP3N0eWxlLmZsb2F0aW5nOnN0eWxlLmZsYXQsZCYmc3R5bGUuaW52ZXJzZSxqJiZzdHlsZS5taW5pKX0se2Rpc2FibGVkOmJ9KSxjJiZoKEljb24se2ljb246YywnY2xhc3MnOnN0eWxlLmljb24sc21hbGw6ITB9KSxlKX19KTtcblxudmFyIHN0eWxlJDIgPSB7ZmllbGQ6XCJfZmllbGRfNDMydDVfMVwiLHRodW1iOlwiX3RodW1iXzQzMnQ1XzhcIixyaXBwbGU6XCJfcmlwcGxlXzQzMnQ1XzE5XCIsb246XCJfb25fNDMydDVfMjJcIixvZmY6XCJfb2ZmXzQzMnQ1XzM3XCJ9O1xuXG52YXIgdGh1bWJGYWN0b3J5ID0gKGE9PmEoYj0+aCgnc3BhbicsX2V4dGVuZHMoeydjbGFzcyc6c3R5bGUkMi50aHVtYn0sYikpKSk7XG5cbmNvbnN0IHN3aXRjaEZhY3Rvcnk9YT0+e3JldHVybiBjbGFzcyBleHRlbmRzIENvbXBvbmVudHtjb25zdHJ1Y3RvciguLi5hcmdzKXt2YXIgX3RlbXA7cmV0dXJuIF90ZW1wPXN1cGVyKC4uLmFyZ3MpLHRoaXMuaGFuZGxlVG9nZ2xlPWI9Pntjb25zb2xlLmxvZygnaGFuZGxlVG9nZ2xlJyx0aGlzLnByb3BzLGIpO2lmKCF0aGlzLnByb3BzLmRpc2FibGVkJiZ0aGlzLnByb3BzLm9uQ2hhbmdlKXt0aGlzLnByb3BzLm9uQ2hhbmdlKCF0aGlzLnByb3BzLmNoZWNrZWQsYik7fX0sX3RlbXB9cmVuZGVyKHtsYWJlbDpiLGNoZWNrZWQ6Yz0hMSxkaXNhYmxlZDpkPSExfSl7cmV0dXJuIGgoJ2xhYmVsJyx7J2NsYXNzJzpkP3N0eWxlJDIuZGlzYWJsZWQ6c3R5bGUkMi5maWVsZCxvbkNsaWNrOnRoaXMuaGFuZGxlVG9nZ2xlfSxoKCdzcGFuJyx7J2NsYXNzJzpjP3N0eWxlJDIub246c3R5bGUkMi5vZmZ9LGgoYSx7ZGlzYWJsZWQ6ZH0pKSxiJiZoKCdzcGFuJyxudWxsLGIpKX19fTtjb25zdCBTd2l0Y2g9c3dpdGNoRmFjdG9yeSh0aHVtYkZhY3RvcnkoUmlwcGxlKHtjZW50ZXJlZDohMCxzcHJlYWQ6Mi42fSkpKTtcblxuZnVuY3Rpb24gY3JlYXRlQ29tbW9uanNNb2R1bGUoZm4sIG1vZHVsZSkge1xuXHRyZXR1cm4gbW9kdWxlID0geyBleHBvcnRzOiB7fSB9LCBmbihtb2R1bGUsIG1vZHVsZS5leHBvcnRzKSwgbW9kdWxlLmV4cG9ydHM7XG59XG5cbnZhciBoYW1tZXI9Y3JlYXRlQ29tbW9uanNNb2R1bGUoZnVuY3Rpb24oYyl7KGZ1bmN0aW9uKGQsZSl7J3VzZSBzdHJpY3QnO3ZhciBnPWZ1bmN0aW9uKEMsRCl7cmV0dXJuIG5ldyBnLkluc3RhbmNlKEMsRHx8e30pfTtnLlZFUlNJT049JzEuMC4xMSc7Zy5kZWZhdWx0cz17c3RvcF9icm93c2VyX2JlaGF2aW9yOnt1c2VyU2VsZWN0Oidub25lJyx0b3VjaEFjdGlvbjoncGFuLXknLHRvdWNoQ2FsbG91dDonbm9uZScsY29udGVudFpvb21pbmc6J25vbmUnLHVzZXJEcmFnOidub25lJyx0YXBIaWdobGlnaHRDb2xvcjoncmdiYSgwLDAsMCwwKSd9fTtnLkhBU19QT0lOVEVSRVZFTlRTPWQubmF2aWdhdG9yLnBvaW50ZXJFbmFibGVkfHxkLm5hdmlnYXRvci5tc1BvaW50ZXJFbmFibGVkO2cuSEFTX1RPVUNIRVZFTlRTPSdvbnRvdWNoc3RhcnQnaW4gZDtnLk1PQklMRV9SRUdFWD0vbW9iaWxlfHRhYmxldHxpcChhZHxob25lfG9kKXxhbmRyb2lkfHNpbGsvaTtnLk5PX01PVVNFRVZFTlRTPWcuSEFTX1RPVUNIRVZFTlRTJiZkLm5hdmlnYXRvci51c2VyQWdlbnQubWF0Y2goZy5NT0JJTEVfUkVHRVgpO2cuRVZFTlRfVFlQRVM9e307Zy5VUERBVEVfVkVMT0NJVFlfSU5URVJWQUw9MTY7Zy5ET0NVTUVOVD1kLmRvY3VtZW50O3ZhciBoJCQxPWcuRElSRUNUSU9OX0RPV049J2Rvd24nLGo9Zy5ESVJFQ1RJT05fTEVGVD0nbGVmdCcsaz1nLkRJUkVDVElPTl9VUD0ndXAnLGw9Zy5ESVJFQ1RJT05fUklHSFQ9J3JpZ2h0JyxtPWcuUE9JTlRFUl9NT1VTRT0nbW91c2UnLG49Zy5QT0lOVEVSX1RPVUNIPSd0b3VjaCcscD1nLlBPSU5URVJfUEVOPSdwZW4nLHE9Zy5FVkVOVF9TVEFSVD0nc3RhcnQnLHI9Zy5FVkVOVF9NT1ZFPSdtb3ZlJyxzPWcuRVZFTlRfRU5EPSdlbmQnO2cucGx1Z2lucz1nLnBsdWdpbnN8fHt9O2cuZ2VzdHVyZXM9Zy5nZXN0dXJlc3x8e307Zy5SRUFEWT0hMTtmdW5jdGlvbiBmKCl7aWYoZy5SRUFEWSl7cmV0dXJufXouZGV0ZXJtaW5lRXZlbnRUeXBlcygpO3QuZWFjaChnLmdlc3R1cmVzLGZ1bmN0aW9uKEMpe0IucmVnaXN0ZXIoQyk7fSk7ei5vblRvdWNoKGcuRE9DVU1FTlQscixCLmRldGVjdCk7ei5vblRvdWNoKGcuRE9DVU1FTlQscyxCLmRldGVjdCk7Zy5SRUFEWT0hMDt9dmFyIHQ9Zy51dGlscz17ZXh0ZW5kOmZ1bmN0aW9uIEMoRCxFLEYpe2Zvcih2YXIgRyBpbiBFKXtpZihEW0ddIT09ZSYmRil7Y29udGludWV9RFtHXT1FW0ddO31yZXR1cm4gRH0sZWFjaDpmdW5jdGlvbiBDKEQsRSxGKXt2YXIgRyxIO2lmKCdmb3JFYWNoJ2luIEQpe0QuZm9yRWFjaChFLEYpO31lbHNlIGlmKEQubGVuZ3RoIT09ZSl7Zm9yKEc9LTE7SD1EWysrR107KXtpZighMT09PUUuY2FsbChGLEgsRyxEKSl7cmV0dXJufX19ZWxzZXtmb3IoRyBpbiBEKXtpZihELmhhc093blByb3BlcnR5KEcpJiYhMT09PUUuY2FsbChGLERbR10sRyxEKSl7cmV0dXJufX19fSxpblN0cjpmdW5jdGlvbiBDKEQsRSl7cmV0dXJuLTE8RC5pbmRleE9mKEUpfSxoYXNQYXJlbnQ6ZnVuY3Rpb24gQyhELEUpe3doaWxlKEQpe2lmKEQ9PUUpe3JldHVybiEwfUQ9RC5wYXJlbnROb2RlO31yZXR1cm4hMX0sZ2V0Q2VudGVyOmZ1bmN0aW9uIEMoRCl7dmFyIEU9W10sRj1bXSxHPVtdLEg9W10sST1NYXRoLm1pbixKPU1hdGgubWF4O2lmKDE9PT1ELmxlbmd0aCl7cmV0dXJue3BhZ2VYOkRbMF0ucGFnZVgscGFnZVk6RFswXS5wYWdlWSxjbGllbnRYOkRbMF0uY2xpZW50WCxjbGllbnRZOkRbMF0uY2xpZW50WX19dC5lYWNoKEQsZnVuY3Rpb24oSyl7RS5wdXNoKEsucGFnZVgpO0YucHVzaChLLnBhZ2VZKTtHLnB1c2goSy5jbGllbnRYKTtILnB1c2goSy5jbGllbnRZKTt9KTtyZXR1cm57cGFnZVg6KEkuYXBwbHkoTWF0aCxFKStKLmFwcGx5KE1hdGgsRSkpLzIscGFnZVk6KEkuYXBwbHkoTWF0aCxGKStKLmFwcGx5KE1hdGgsRikpLzIsY2xpZW50WDooSS5hcHBseShNYXRoLEcpK0ouYXBwbHkoTWF0aCxHKSkvMixjbGllbnRZOihJLmFwcGx5KE1hdGgsSCkrSi5hcHBseShNYXRoLEgpKS8yfX0sZ2V0VmVsb2NpdHk6ZnVuY3Rpb24gQyhELEUsRil7cmV0dXJue3g6TWF0aC5hYnMoRS9EKXx8MCx5Ok1hdGguYWJzKEYvRCl8fDB9fSxnZXRBbmdsZTpmdW5jdGlvbiBDKEQsRSl7dmFyIEY9RS5jbGllbnRYLUQuY2xpZW50WCxHPUUuY2xpZW50WS1ELmNsaWVudFk7cmV0dXJuIDE4MCpNYXRoLmF0YW4yKEcsRikvTWF0aC5QSX0sZ2V0RGlyZWN0aW9uOmZ1bmN0aW9uIEMoRCxFKXt2YXIgRj1NYXRoLmFicyhELmNsaWVudFgtRS5jbGllbnRYKSxHPU1hdGguYWJzKEQuY2xpZW50WS1FLmNsaWVudFkpO2lmKEY+PUcpe3JldHVybiAwPEQuY2xpZW50WC1FLmNsaWVudFg/ajpsfXJldHVybiAwPEQuY2xpZW50WS1FLmNsaWVudFk/azpoJCQxfSxnZXREaXN0YW5jZTpmdW5jdGlvbiBDKEQsRSl7dmFyIEY9RS5jbGllbnRYLUQuY2xpZW50WCxHPUUuY2xpZW50WS1ELmNsaWVudFk7cmV0dXJuIE1hdGguc3FydChGKkYrRypHKX0sZ2V0U2NhbGU6ZnVuY3Rpb24gQyhELEUpe2lmKDI8PUQubGVuZ3RoJiYyPD1FLmxlbmd0aCl7cmV0dXJuIHRoaXMuZ2V0RGlzdGFuY2UoRVswXSxFWzFdKS90aGlzLmdldERpc3RhbmNlKERbMF0sRFsxXSl9cmV0dXJuIDF9LGdldFJvdGF0aW9uOmZ1bmN0aW9uIEMoRCxFKXtpZigyPD1ELmxlbmd0aCYmMjw9RS5sZW5ndGgpe3JldHVybiB0aGlzLmdldEFuZ2xlKEVbMV0sRVswXSktdGhpcy5nZXRBbmdsZShEWzFdLERbMF0pfXJldHVybiAwfSxpc1ZlcnRpY2FsOmZ1bmN0aW9uIEMoRCl7cmV0dXJuIEQ9PWt8fEQ9PWgkJDF9LHRvZ2dsZURlZmF1bHRCZWhhdmlvcjpmdW5jdGlvbiBDKEQsRSxGKXtpZighRXx8IUR8fCFELnN0eWxlKXtyZXR1cm59dC5lYWNoKFsnd2Via2l0JywnbW96JywnTW96JywnbXMnLCdvJywnJ10sZnVuY3Rpb24gSChJKXt0LmVhY2goRSxmdW5jdGlvbihKLEspe2lmKEkpe0s9SStLLnN1YnN0cmluZygwLDEpLnRvVXBwZXJDYXNlKCkrSy5zdWJzdHJpbmcoMSk7fWlmKEsgaW4gRC5zdHlsZSl7RC5zdHlsZVtLXT0hRiYmSjt9fSk7fSk7dmFyIEc9ZnVuY3Rpb24oKXtyZXR1cm4hMX07aWYoJ25vbmUnPT1FLnVzZXJTZWxlY3Qpe0Qub25zZWxlY3RzdGFydD0hRiYmRzt9aWYoJ25vbmUnPT1FLnVzZXJEcmFnKXtELm9uZHJhZ3N0YXJ0PSFGJiZHO319fTtnLkluc3RhbmNlPWZ1bmN0aW9uKEMsRCl7dmFyIEU9dGhpcztmKCk7dGhpcy5lbGVtZW50PUM7dGhpcy5lbmFibGVkPSEwO3RoaXMub3B0aW9ucz10LmV4dGVuZCh0LmV4dGVuZCh7fSxnLmRlZmF1bHRzKSxEfHx7fSk7aWYodGhpcy5vcHRpb25zLnN0b3BfYnJvd3Nlcl9iZWhhdmlvcil7dC50b2dnbGVEZWZhdWx0QmVoYXZpb3IodGhpcy5lbGVtZW50LHRoaXMub3B0aW9ucy5zdG9wX2Jyb3dzZXJfYmVoYXZpb3IsITEpO310aGlzLmV2ZW50U3RhcnRIYW5kbGVyPXoub25Ub3VjaChDLHEsZnVuY3Rpb24oRil7aWYoRS5lbmFibGVkKXtCLnN0YXJ0RGV0ZWN0KEUsRik7fX0pO3RoaXMuZXZlbnRIYW5kbGVycz1bXTtyZXR1cm4gdGhpc307Zy5JbnN0YW5jZS5wcm90b3R5cGU9e29uOmZ1bmN0aW9uIEMoRCxFKXt2YXIgRj1ELnNwbGl0KCcgJyk7dC5lYWNoKEYsZnVuY3Rpb24oRyl7dGhpcy5lbGVtZW50LmFkZEV2ZW50TGlzdGVuZXIoRyxFLCExKTt0aGlzLmV2ZW50SGFuZGxlcnMucHVzaCh7Z2VzdHVyZTpHLGhhbmRsZXI6RX0pO30sdGhpcyk7cmV0dXJuIHRoaXN9LG9mZjpmdW5jdGlvbiBDKEQsRSl7dmFyIEY9RC5zcGxpdCgnICcpLEcsSDt0LmVhY2goRixmdW5jdGlvbihJKXt0aGlzLmVsZW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lcihJLEUsITEpO2ZvcihHPS0xO0g9dGhpcy5ldmVudEhhbmRsZXJzWysrR107KXtpZihILmdlc3R1cmU9PT1JJiZILmhhbmRsZXI9PT1FKXt0aGlzLmV2ZW50SGFuZGxlcnMuc3BsaWNlKEcsMSk7fX19LHRoaXMpO3JldHVybiB0aGlzfSx0cmlnZ2VyOmZ1bmN0aW9uIEMoRCxFKXtpZighRSl7RT17fTt9dmFyIEY9Zy5ET0NVTUVOVC5jcmVhdGVFdmVudCgnRXZlbnQnKTtGLmluaXRFdmVudChELCEwLCEwKTtGLmdlc3R1cmU9RTt2YXIgRz10aGlzLmVsZW1lbnQ7aWYodC5oYXNQYXJlbnQoRS50YXJnZXQsRykpe0c9RS50YXJnZXQ7fUcuZGlzcGF0Y2hFdmVudChGKTtyZXR1cm4gdGhpc30sZW5hYmxlOmZ1bmN0aW9uIEMoRCl7dGhpcy5lbmFibGVkPUQ7cmV0dXJuIHRoaXN9LGRpc3Bvc2U6ZnVuY3Rpb24gQygpe3ZhciBELEU7aWYodGhpcy5vcHRpb25zLnN0b3BfYnJvd3Nlcl9iZWhhdmlvcil7dC50b2dnbGVEZWZhdWx0QmVoYXZpb3IodGhpcy5lbGVtZW50LHRoaXMub3B0aW9ucy5zdG9wX2Jyb3dzZXJfYmVoYXZpb3IsITApO31mb3IoRD0tMTtFPXRoaXMuZXZlbnRIYW5kbGVyc1srK0RdOyl7dGhpcy5lbGVtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoRS5nZXN0dXJlLEUuaGFuZGxlciwhMSk7fXRoaXMuZXZlbnRIYW5kbGVycz1bXTt6LnVuYmluZERvbSh0aGlzLmVsZW1lbnQsZy5FVkVOVF9UWVBFU1txXSx0aGlzLmV2ZW50U3RhcnRIYW5kbGVyKTtyZXR1cm4gbnVsbH19O3ZhciB1PW51bGwsdj0hMSx3PSExLHo9Zy5ldmVudD17YmluZERvbTpmdW5jdGlvbihDLEQsRSl7dmFyIEY9RC5zcGxpdCgnICcpO3QuZWFjaChGLGZ1bmN0aW9uKEcpe0MuYWRkRXZlbnRMaXN0ZW5lcihHLEUsITEpO30pO30sdW5iaW5kRG9tOmZ1bmN0aW9uKEMsRCxFKXt2YXIgRj1ELnNwbGl0KCcgJyk7dC5lYWNoKEYsZnVuY3Rpb24oRyl7Qy5yZW1vdmVFdmVudExpc3RlbmVyKEcsRSwhMSk7fSk7fSxvblRvdWNoOmZ1bmN0aW9uIEMoRCxFLEYpe3ZhciBHPXRoaXMsSD1mdW5jdGlvbiBJKEope3ZhciBLPUoudHlwZS50b0xvd2VyQ2FzZSgpO2lmKHQuaW5TdHIoSywnbW91c2UnKSYmdyl7cmV0dXJufWVsc2UgaWYodC5pblN0cihLLCd0b3VjaCcpfHx0LmluU3RyKEssJ3BvaW50ZXJkb3duJyl8fHQuaW5TdHIoSywnbW91c2UnKSYmMT09PUoud2hpY2gpe3Y9ITA7fWVsc2UgaWYodC5pblN0cihLLCdtb3VzZScpJiYhSi53aGljaCl7dj0hMTt9aWYodC5pblN0cihLLCd0b3VjaCcpfHx0LmluU3RyKEssJ3BvaW50ZXInKSl7dz0hMDt9dmFyIEw9MDtpZih2KXtpZihnLkhBU19QT0lOVEVSRVZFTlRTJiZFIT1zKXtMPUEudXBkYXRlUG9pbnRlcihFLEopO31lbHNlIGlmKHQuaW5TdHIoSywndG91Y2gnKSl7TD1KLnRvdWNoZXMubGVuZ3RoO31lbHNlIGlmKCF3KXtMPXQuaW5TdHIoSywndXAnKT8wOjE7fWlmKDA8TCYmRT09cyl7RT1yO31lbHNlIGlmKCFMKXtFPXM7fWlmKEx8fG51bGw9PXUpe3U9Sjt9Ri5jYWxsKEIsRy5jb2xsZWN0RXZlbnREYXRhKEQsRSxHLmdldFRvdWNoTGlzdCh1LEUpLEopKTtpZihnLkhBU19QT0lOVEVSRVZFTlRTJiZFPT1zKXtMPUEudXBkYXRlUG9pbnRlcihFLEopO319aWYoIUwpe3U9bnVsbDt2PSExO3c9ITE7QS5yZXNldCgpO319O3RoaXMuYmluZERvbShELGcuRVZFTlRfVFlQRVNbRV0sSCk7cmV0dXJuIEh9LGRldGVybWluZUV2ZW50VHlwZXM6ZnVuY3Rpb24gQygpe3ZhciBEO2lmKGcuSEFTX1BPSU5URVJFVkVOVFMpe0Q9QS5nZXRFdmVudHMoKTt9ZWxzZSBpZihnLk5PX01PVVNFRVZFTlRTKXtEPVsndG91Y2hzdGFydCcsJ3RvdWNobW92ZScsJ3RvdWNoZW5kIHRvdWNoY2FuY2VsJ107fWVsc2V7RD1bJ3RvdWNoc3RhcnQgbW91c2Vkb3duJywndG91Y2htb3ZlIG1vdXNlbW92ZScsJ3RvdWNoZW5kIHRvdWNoY2FuY2VsIG1vdXNldXAnXTt9Zy5FVkVOVF9UWVBFU1txXT1EWzBdO2cuRVZFTlRfVFlQRVNbcl09RFsxXTtnLkVWRU5UX1RZUEVTW3NdPURbMl07fSxnZXRUb3VjaExpc3Q6ZnVuY3Rpb24gQyhEKXtpZihnLkhBU19QT0lOVEVSRVZFTlRTKXtyZXR1cm4gQS5nZXRUb3VjaExpc3QoKX1pZihELnRvdWNoZXMpe3JldHVybiBELnRvdWNoZXN9RC5pZGVudGlmaWVyPTE7cmV0dXJuW0RdfSxjb2xsZWN0RXZlbnREYXRhOmZ1bmN0aW9uIEMoRCxFLEYsRyl7dmFyIEg9bjtpZih0LmluU3RyKEcudHlwZSwnbW91c2UnKXx8QS5tYXRjaFR5cGUobSxHKSl7SD1tO31yZXR1cm57Y2VudGVyOnQuZ2V0Q2VudGVyKEYpLHRpbWVTdGFtcDpEYXRlLm5vdygpLHRhcmdldDpHLnRhcmdldCx0b3VjaGVzOkYsZXZlbnRUeXBlOkUscG9pbnRlclR5cGU6SCxzcmNFdmVudDpHLHByZXZlbnREZWZhdWx0OmZ1bmN0aW9uKCl7dmFyIEk9dGhpcy5zcmNFdmVudDtJLnByZXZlbnRNYW5pcHVsYXRpb24mJkkucHJldmVudE1hbmlwdWxhdGlvbigpO0kucHJldmVudERlZmF1bHQmJkkucHJldmVudERlZmF1bHQoKTt9LHN0b3BQcm9wYWdhdGlvbjpmdW5jdGlvbigpe3RoaXMuc3JjRXZlbnQuc3RvcFByb3BhZ2F0aW9uKCk7fSxzdG9wRGV0ZWN0OmZ1bmN0aW9uKCl7cmV0dXJuIEIuc3RvcERldGVjdCgpfX19fSxBPWcuUG9pbnRlckV2ZW50PXtwb2ludGVyczp7fSxnZXRUb3VjaExpc3Q6ZnVuY3Rpb24gQygpe3ZhciBEPVtdO3QuZWFjaCh0aGlzLnBvaW50ZXJzLGZ1bmN0aW9uKEUpe0QucHVzaChFKTt9KTtyZXR1cm4gRH0sdXBkYXRlUG9pbnRlcjpmdW5jdGlvbiBDKEQsRSl7aWYoRD09cyl7ZGVsZXRlIHRoaXMucG9pbnRlcnNbRS5wb2ludGVySWRdO31lbHNle0UuaWRlbnRpZmllcj1FLnBvaW50ZXJJZDt0aGlzLnBvaW50ZXJzW0UucG9pbnRlcklkXT1FO31yZXR1cm4gT2JqZWN0LmtleXModGhpcy5wb2ludGVycykubGVuZ3RofSxtYXRjaFR5cGU6ZnVuY3Rpb24gQyhELEUpe2lmKCFFLnBvaW50ZXJUeXBlKXtyZXR1cm4hMX12YXIgRj1FLnBvaW50ZXJUeXBlLEc9e307R1ttXT1GPT09bTtHW25dPUY9PT1uO0dbcF09Rj09PXA7cmV0dXJuIEdbRF19LGdldEV2ZW50czpmdW5jdGlvbiBDKCl7cmV0dXJuWydwb2ludGVyZG93biBNU1BvaW50ZXJEb3duJywncG9pbnRlcm1vdmUgTVNQb2ludGVyTW92ZScsJ3BvaW50ZXJ1cCBwb2ludGVyY2FuY2VsIE1TUG9pbnRlclVwIE1TUG9pbnRlckNhbmNlbCddfSxyZXNldDpmdW5jdGlvbiBDKCl7dGhpcy5wb2ludGVycz17fTt9fSxCPWcuZGV0ZWN0aW9uPXtnZXN0dXJlczpbXSxjdXJyZW50Om51bGwscHJldmlvdXM6bnVsbCxzdG9wcGVkOiExLHN0YXJ0RGV0ZWN0OmZ1bmN0aW9uIEMoRCxFKXtpZih0aGlzLmN1cnJlbnQpe3JldHVybn10aGlzLnN0b3BwZWQ9ITE7dGhpcy5jdXJyZW50PXtpbnN0OkQsc3RhcnRFdmVudDp0LmV4dGVuZCh7fSxFKSxsYXN0RXZlbnQ6ITEsbGFzdFZlbG9jaXR5RXZlbnQ6ITEsdmVsb2NpdHk6ITEsbmFtZTonJ307dGhpcy5kZXRlY3QoRSk7fSxkZXRlY3Q6ZnVuY3Rpb24gQyhEKXtpZighdGhpcy5jdXJyZW50fHx0aGlzLnN0b3BwZWQpe3JldHVybn1EPXRoaXMuZXh0ZW5kRXZlbnREYXRhKEQpO3ZhciBFPXRoaXMuY3VycmVudC5pbnN0LEY9RS5vcHRpb25zO3QuZWFjaCh0aGlzLmdlc3R1cmVzLGZ1bmN0aW9uIEcoSCl7aWYoIXRoaXMuc3RvcHBlZCYmITEhPT1GW0gubmFtZV0mJiExIT09RS5lbmFibGVkKXtpZighMT09PUguaGFuZGxlci5jYWxsKEgsRCxFKSl7dGhpcy5zdG9wRGV0ZWN0KCk7cmV0dXJuITF9fX0sdGhpcyk7aWYodGhpcy5jdXJyZW50KXt0aGlzLmN1cnJlbnQubGFzdEV2ZW50PUQ7fWlmKEQuZXZlbnRUeXBlPT1zJiYhRC50b3VjaGVzLmxlbmd0aC0xKXt0aGlzLnN0b3BEZXRlY3QoKTt9cmV0dXJuIER9LHN0b3BEZXRlY3Q6ZnVuY3Rpb24gQygpe3RoaXMucHJldmlvdXM9dC5leHRlbmQoe30sdGhpcy5jdXJyZW50KTt0aGlzLmN1cnJlbnQ9bnVsbDt0aGlzLnN0b3BwZWQ9ITA7fSxnZXRWZWxvY2l0eURhdGE6ZnVuY3Rpb24gQyhELEUsRixHKXt2YXIgSD10aGlzLmN1cnJlbnQsST1ILmxhc3RWZWxvY2l0eUV2ZW50LEo9SC52ZWxvY2l0eTtpZihJJiZELnRpbWVTdGFtcC1JLnRpbWVTdGFtcD5nLlVQREFURV9WRUxPQ0lUWV9JTlRFUlZBTCl7Sj10LmdldFZlbG9jaXR5KEQudGltZVN0YW1wLUkudGltZVN0YW1wLEQuY2VudGVyLmNsaWVudFgtSS5jZW50ZXIuY2xpZW50WCxELmNlbnRlci5jbGllbnRZLUkuY2VudGVyLmNsaWVudFkpO0gubGFzdFZlbG9jaXR5RXZlbnQ9RDt9ZWxzZSBpZighSC52ZWxvY2l0eSl7Sj10LmdldFZlbG9jaXR5KEUsRixHKTtILmxhc3RWZWxvY2l0eUV2ZW50PUQ7fUgudmVsb2NpdHk9SjtELnZlbG9jaXR5WD1KLng7RC52ZWxvY2l0eVk9Si55O30sZ2V0SW50ZXJpbURhdGE6ZnVuY3Rpb24gQyhEKXt2YXIgRT10aGlzLmN1cnJlbnQubGFzdEV2ZW50LEYsRztpZihELmV2ZW50VHlwZT09cyl7Rj1FJiZFLmludGVyaW1BbmdsZTtHPUUmJkUuaW50ZXJpbURpcmVjdGlvbjt9ZWxzZXtGPUUmJnQuZ2V0QW5nbGUoRS5jZW50ZXIsRC5jZW50ZXIpO0c9RSYmdC5nZXREaXJlY3Rpb24oRS5jZW50ZXIsRC5jZW50ZXIpO31ELmludGVyaW1BbmdsZT1GO0QuaW50ZXJpbURpcmVjdGlvbj1HO30sZXh0ZW5kRXZlbnREYXRhOmZ1bmN0aW9uIEMoRCl7dmFyIEU9dGhpcy5jdXJyZW50LEY9RS5zdGFydEV2ZW50O2lmKEQudG91Y2hlcy5sZW5ndGghPUYudG91Y2hlcy5sZW5ndGh8fEQudG91Y2hlcz09PUYudG91Y2hlcyl7Ri50b3VjaGVzPVtdO3QuZWFjaChELnRvdWNoZXMsZnVuY3Rpb24oSil7Ri50b3VjaGVzLnB1c2godC5leHRlbmQoe30sSikpO30pO312YXIgRz1ELnRpbWVTdGFtcC1GLnRpbWVTdGFtcCxIPUQuY2VudGVyLmNsaWVudFgtRi5jZW50ZXIuY2xpZW50WCxJPUQuY2VudGVyLmNsaWVudFktRi5jZW50ZXIuY2xpZW50WTt0aGlzLmdldFZlbG9jaXR5RGF0YShELEcsSCxJKTt0aGlzLmdldEludGVyaW1EYXRhKEQpO3QuZXh0ZW5kKEQse3N0YXJ0RXZlbnQ6RixkZWx0YVRpbWU6RyxkZWx0YVg6SCxkZWx0YVk6SSxkaXN0YW5jZTp0LmdldERpc3RhbmNlKEYuY2VudGVyLEQuY2VudGVyKSxhbmdsZTp0LmdldEFuZ2xlKEYuY2VudGVyLEQuY2VudGVyKSxkaXJlY3Rpb246dC5nZXREaXJlY3Rpb24oRi5jZW50ZXIsRC5jZW50ZXIpLHNjYWxlOnQuZ2V0U2NhbGUoRi50b3VjaGVzLEQudG91Y2hlcykscm90YXRpb246dC5nZXRSb3RhdGlvbihGLnRvdWNoZXMsRC50b3VjaGVzKX0pO3JldHVybiBEfSxyZWdpc3RlcjpmdW5jdGlvbiBDKEQpe3ZhciBFPUQuZGVmYXVsdHN8fHt9O2lmKEVbRC5uYW1lXT09PWUpe0VbRC5uYW1lXT0hMDt9dC5leHRlbmQoZy5kZWZhdWx0cyxFLCEwKTtELmluZGV4PUQuaW5kZXh8fDEwMDA7dGhpcy5nZXN0dXJlcy5wdXNoKEQpO3RoaXMuZ2VzdHVyZXMuc29ydChmdW5jdGlvbihGLEcpe2lmKEYuaW5kZXg8Ry5pbmRleCl7cmV0dXJuLTF9aWYoRi5pbmRleD5HLmluZGV4KXtyZXR1cm4gMX1yZXR1cm4gMH0pO3JldHVybiB0aGlzLmdlc3R1cmVzfX07Zy5nZXN0dXJlcy5EcmFnPXtuYW1lOidkcmFnJyxpbmRleDo1MCxkZWZhdWx0czp7ZHJhZ19taW5fZGlzdGFuY2U6MTAsY29ycmVjdF9mb3JfZHJhZ19taW5fZGlzdGFuY2U6ITAsZHJhZ19tYXhfdG91Y2hlczoxLGRyYWdfYmxvY2tfaG9yaXpvbnRhbDohMSxkcmFnX2Jsb2NrX3ZlcnRpY2FsOiExLGRyYWdfbG9ja190b19heGlzOiExLGRyYWdfbG9ja19taW5fZGlzdGFuY2U6MjV9LHRyaWdnZXJlZDohMSxoYW5kbGVyOmZ1bmN0aW9uIEMoRCxFKXt2YXIgRj1CLmN1cnJlbnQ7aWYoRi5uYW1lIT10aGlzLm5hbWUmJnRoaXMudHJpZ2dlcmVkKXtFLnRyaWdnZXIodGhpcy5uYW1lKydlbmQnLEQpO3RoaXMudHJpZ2dlcmVkPSExO3JldHVybn1pZigwPEUub3B0aW9ucy5kcmFnX21heF90b3VjaGVzJiZELnRvdWNoZXMubGVuZ3RoPkUub3B0aW9ucy5kcmFnX21heF90b3VjaGVzKXtyZXR1cm59c3dpdGNoKEQuZXZlbnRUeXBlKXtjYXNlIHE6dGhpcy50cmlnZ2VyZWQ9ITE7YnJlYWs7Y2FzZSByOmlmKEQuZGlzdGFuY2U8RS5vcHRpb25zLmRyYWdfbWluX2Rpc3RhbmNlJiZGLm5hbWUhPXRoaXMubmFtZSl7cmV0dXJufXZhciBHPUYuc3RhcnRFdmVudC5jZW50ZXI7aWYoRi5uYW1lIT10aGlzLm5hbWUpe0YubmFtZT10aGlzLm5hbWU7aWYoRS5vcHRpb25zLmNvcnJlY3RfZm9yX2RyYWdfbWluX2Rpc3RhbmNlJiYwPEQuZGlzdGFuY2Upe3ZhciBIPU1hdGguYWJzKEUub3B0aW9ucy5kcmFnX21pbl9kaXN0YW5jZS9ELmRpc3RhbmNlKTtHLnBhZ2VYKz1ELmRlbHRhWCpIO0cucGFnZVkrPUQuZGVsdGFZKkg7Ry5jbGllbnRYKz1ELmRlbHRhWCpIO0cuY2xpZW50WSs9RC5kZWx0YVkqSDtEPUIuZXh0ZW5kRXZlbnREYXRhKEQpO319aWYoRi5sYXN0RXZlbnQuZHJhZ19sb2NrZWRfdG9fYXhpc3x8RS5vcHRpb25zLmRyYWdfbG9ja190b19heGlzJiZFLm9wdGlvbnMuZHJhZ19sb2NrX21pbl9kaXN0YW5jZTw9RC5kaXN0YW5jZSl7RC5kcmFnX2xvY2tlZF90b19heGlzPSEwO312YXIgST1GLmxhc3RFdmVudC5kaXJlY3Rpb247aWYoRC5kcmFnX2xvY2tlZF90b19heGlzJiZJIT09RC5kaXJlY3Rpb24pe2lmKHQuaXNWZXJ0aWNhbChJKSl7RC5kaXJlY3Rpb249MD5ELmRlbHRhWT9rOmgkJDE7fWVsc2V7RC5kaXJlY3Rpb249MD5ELmRlbHRhWD9qOmw7fX1pZighdGhpcy50cmlnZ2VyZWQpe0UudHJpZ2dlcih0aGlzLm5hbWUrJ3N0YXJ0JyxEKTt0aGlzLnRyaWdnZXJlZD0hMDt9RS50cmlnZ2VyKHRoaXMubmFtZSxEKTtFLnRyaWdnZXIodGhpcy5uYW1lK0QuZGlyZWN0aW9uLEQpO3ZhciBKPXQuaXNWZXJ0aWNhbChELmRpcmVjdGlvbik7aWYoRS5vcHRpb25zLmRyYWdfYmxvY2tfdmVydGljYWwmJkp8fEUub3B0aW9ucy5kcmFnX2Jsb2NrX2hvcml6b250YWwmJiFKKXtELnByZXZlbnREZWZhdWx0KCk7fWJyZWFrO2Nhc2UgczppZih0aGlzLnRyaWdnZXJlZCl7RS50cmlnZ2VyKHRoaXMubmFtZSsnZW5kJyxEKTt9dGhpcy50cmlnZ2VyZWQ9ITE7YnJlYWs7fX19O2cuZ2VzdHVyZXMuSG9sZD17bmFtZTonaG9sZCcsaW5kZXg6MTAsZGVmYXVsdHM6e2hvbGRfdGltZW91dDo1MDAsaG9sZF90aHJlc2hvbGQ6Mn0sdGltZXI6bnVsbCxoYW5kbGVyOmZ1bmN0aW9uIEMoRCxFKXtzd2l0Y2goRC5ldmVudFR5cGUpe2Nhc2UgcTpjbGVhclRpbWVvdXQodGhpcy50aW1lcik7Qi5jdXJyZW50Lm5hbWU9dGhpcy5uYW1lO3RoaXMudGltZXI9c2V0VGltZW91dChmdW5jdGlvbigpe2lmKCdob2xkJz09Qi5jdXJyZW50Lm5hbWUpe0UudHJpZ2dlcignaG9sZCcsRCk7fX0sRS5vcHRpb25zLmhvbGRfdGltZW91dCk7YnJlYWs7Y2FzZSByOmlmKEQuZGlzdGFuY2U+RS5vcHRpb25zLmhvbGRfdGhyZXNob2xkKXtjbGVhclRpbWVvdXQodGhpcy50aW1lcik7fWJyZWFrO2Nhc2UgczpjbGVhclRpbWVvdXQodGhpcy50aW1lcik7YnJlYWs7fX19O2cuZ2VzdHVyZXMuUmVsZWFzZT17bmFtZToncmVsZWFzZScsaW5kZXg6MS8wLGhhbmRsZXI6ZnVuY3Rpb24gQyhELEUpe2lmKEQuZXZlbnRUeXBlPT1zKXtFLnRyaWdnZXIodGhpcy5uYW1lLEQpO319fTtnLmdlc3R1cmVzLlN3aXBlPXtuYW1lOidzd2lwZScsaW5kZXg6NDAsZGVmYXVsdHM6e3N3aXBlX21pbl90b3VjaGVzOjEsc3dpcGVfbWF4X3RvdWNoZXM6MSxzd2lwZV92ZWxvY2l0eTowLjd9LGhhbmRsZXI6ZnVuY3Rpb24gQyhELEUpe2lmKEQuZXZlbnRUeXBlPT1zKXtpZihELnRvdWNoZXMubGVuZ3RoPEUub3B0aW9ucy5zd2lwZV9taW5fdG91Y2hlc3x8RC50b3VjaGVzLmxlbmd0aD5FLm9wdGlvbnMuc3dpcGVfbWF4X3RvdWNoZXMpe3JldHVybn1pZihELnZlbG9jaXR5WD5FLm9wdGlvbnMuc3dpcGVfdmVsb2NpdHl8fEQudmVsb2NpdHlZPkUub3B0aW9ucy5zd2lwZV92ZWxvY2l0eSl7RS50cmlnZ2VyKHRoaXMubmFtZSxEKTtFLnRyaWdnZXIodGhpcy5uYW1lK0QuZGlyZWN0aW9uLEQpO319fX07Zy5nZXN0dXJlcy5UYXA9e25hbWU6J3RhcCcsaW5kZXg6MTAwLGRlZmF1bHRzOnt0YXBfbWF4X3RvdWNodGltZToyNTAsdGFwX21heF9kaXN0YW5jZToxMCx0YXBfYWx3YXlzOiEwLGRvdWJsZXRhcF9kaXN0YW5jZToyMCxkb3VibGV0YXBfaW50ZXJ2YWw6MzAwfSxoYXNfbW92ZWQ6ITEsaGFuZGxlcjpmdW5jdGlvbiBDKEQsRSl7dmFyIEYsRyxIO2lmKEQuZXZlbnRUeXBlPT1xKXt0aGlzLmhhc19tb3ZlZD0hMTt9ZWxzZSBpZihELmV2ZW50VHlwZT09ciYmIXRoaXMubW92ZWQpe3RoaXMuaGFzX21vdmVkPUQuZGlzdGFuY2U+RS5vcHRpb25zLnRhcF9tYXhfZGlzdGFuY2U7fWVsc2UgaWYoRC5ldmVudFR5cGU9PXMmJid0b3VjaGNhbmNlbCchPUQuc3JjRXZlbnQudHlwZSYmRC5kZWx0YVRpbWU8RS5vcHRpb25zLnRhcF9tYXhfdG91Y2h0aW1lJiYhdGhpcy5oYXNfbW92ZWQpe0Y9Qi5wcmV2aW91cztHPUYmJkYubGFzdEV2ZW50JiZELnRpbWVTdGFtcC1GLmxhc3RFdmVudC50aW1lU3RhbXA7SD0hMTtpZihGJiYndGFwJz09Ri5uYW1lJiZHJiZHPEUub3B0aW9ucy5kb3VibGV0YXBfaW50ZXJ2YWwmJkQuZGlzdGFuY2U8RS5vcHRpb25zLmRvdWJsZXRhcF9kaXN0YW5jZSl7RS50cmlnZ2VyKCdkb3VibGV0YXAnLEQpO0g9ITA7fWlmKCFIfHxFLm9wdGlvbnMudGFwX2Fsd2F5cyl7Qi5jdXJyZW50Lm5hbWU9J3RhcCc7RS50cmlnZ2VyKEIuY3VycmVudC5uYW1lLEQpO319fX07Zy5nZXN0dXJlcy5Ub3VjaD17bmFtZTondG91Y2gnLGluZGV4Oi0oMS8wKSxkZWZhdWx0czp7cHJldmVudF9kZWZhdWx0OiExLHByZXZlbnRfbW91c2VldmVudHM6ITF9LGhhbmRsZXI6ZnVuY3Rpb24gQyhELEUpe2lmKEUub3B0aW9ucy5wcmV2ZW50X21vdXNlZXZlbnRzJiZELnBvaW50ZXJUeXBlPT1tKXtELnN0b3BEZXRlY3QoKTtyZXR1cm59aWYoRS5vcHRpb25zLnByZXZlbnRfZGVmYXVsdCl7RC5wcmV2ZW50RGVmYXVsdCgpO31pZihELmV2ZW50VHlwZT09cSl7RS50cmlnZ2VyKHRoaXMubmFtZSxEKTt9fX07Zy5nZXN0dXJlcy5UcmFuc2Zvcm09e25hbWU6J3RyYW5zZm9ybScsaW5kZXg6NDUsZGVmYXVsdHM6e3RyYW5zZm9ybV9taW5fc2NhbGU6MC4wMSx0cmFuc2Zvcm1fbWluX3JvdGF0aW9uOjEsdHJhbnNmb3JtX2Fsd2F5c19ibG9jazohMSx0cmFuc2Zvcm1fd2l0aGluX2luc3RhbmNlOiExfSx0cmlnZ2VyZWQ6ITEsaGFuZGxlcjpmdW5jdGlvbiBDKEQsRSl7aWYoQi5jdXJyZW50Lm5hbWUhPXRoaXMubmFtZSYmdGhpcy50cmlnZ2VyZWQpe0UudHJpZ2dlcih0aGlzLm5hbWUrJ2VuZCcsRCk7dGhpcy50cmlnZ2VyZWQ9ITE7cmV0dXJufWlmKDI+RC50b3VjaGVzLmxlbmd0aCl7cmV0dXJufWlmKEUub3B0aW9ucy50cmFuc2Zvcm1fYWx3YXlzX2Jsb2NrKXtELnByZXZlbnREZWZhdWx0KCk7fWlmKEUub3B0aW9ucy50cmFuc2Zvcm1fd2l0aGluX2luc3RhbmNlKXtmb3IodmFyIEY9LTE7RC50b3VjaGVzWysrRl07KXtpZighdC5oYXNQYXJlbnQoRC50b3VjaGVzW0ZdLnRhcmdldCxFLmVsZW1lbnQpKXtyZXR1cm59fX1zd2l0Y2goRC5ldmVudFR5cGUpe2Nhc2UgcTp0aGlzLnRyaWdnZXJlZD0hMTticmVhaztjYXNlIHI6dmFyIEc9TWF0aC5hYnMoMS1ELnNjYWxlKSxIPU1hdGguYWJzKEQucm90YXRpb24pO2lmKEc8RS5vcHRpb25zLnRyYW5zZm9ybV9taW5fc2NhbGUmJkg8RS5vcHRpb25zLnRyYW5zZm9ybV9taW5fcm90YXRpb24pe3JldHVybn1CLmN1cnJlbnQubmFtZT10aGlzLm5hbWU7aWYoIXRoaXMudHJpZ2dlcmVkKXtFLnRyaWdnZXIodGhpcy5uYW1lKydzdGFydCcsRCk7dGhpcy50cmlnZ2VyZWQ9ITA7fUUudHJpZ2dlcih0aGlzLm5hbWUsRCk7aWYoSD5FLm9wdGlvbnMudHJhbnNmb3JtX21pbl9yb3RhdGlvbil7RS50cmlnZ2VyKCdyb3RhdGUnLEQpO31pZihHPkUub3B0aW9ucy50cmFuc2Zvcm1fbWluX3NjYWxlKXtFLnRyaWdnZXIoJ3BpbmNoJyxEKTtFLnRyaWdnZXIoJ3BpbmNoJysoMT5ELnNjYWxlPydpbic6J291dCcpLEQpO31icmVhaztjYXNlIHM6aWYodGhpcy50cmlnZ2VyZWQpe0UudHJpZ2dlcih0aGlzLm5hbWUrJ2VuZCcsRCk7fXRoaXMudHJpZ2dlcmVkPSExO2JyZWFrO319fTtpZignZnVuY3Rpb24nPT10eXBlb2YgZGVmaW5lJiZkZWZpbmUuYW1kKXtkZWZpbmUoZnVuY3Rpb24oKXtyZXR1cm4gZ30pO31lbHNlIGlmKCdvYmplY3QnPT10eXBlb2YgYyYmYy5leHBvcnRzKXtjLmV4cG9ydHM9Zzt9ZWxzZXtkLkhhbW1lcj1nO319KSh3aW5kb3cpO30pO1xuXG5jb25zdCBzdGFjaz1bXTtsZXQgc2luaz17fTtjb25zdCBmb2N1cz1uZXcobWl4aW5FdmVudEVtaXR0ZXIoY2xhc3N7Y29uc3RydWN0b3IoKXtoYW1tZXIod2luZG93LmRvY3VtZW50LmJvZHkse2RyYWdfbG9ja190b19heGlzOiEwfSkub24oJ3RhcCBkcmFnbGVmdCBkcmFncmlnaHQgZHJhZ2VuZCBzd2lwZWxlZnQgc3dpcGVyaWdodCcsYT0+e2lmKHNpbmsub25HZXN0dXJlKXNpbmsub25HZXN0dXJlKGEpO2Vsc2UgaWYoc2luay5lbWl0KXNpbmsuZW1pdCgnZ2VzdHVyZScsYSk7fSk7ZG9jdW1lbnQub25rZXlkb3duPWE9PntpZig4PT09YS5rZXlDb2RlKXtjb25zb2xlLmxvZygnYmFjaycpO3ZhciBiPWEuc3JjRWxlbWVudHx8YS50YXJnZXQ7aWYoISgnSU5QVVQnPT09Yi50YWdOYW1lLnRvVXBwZXJDYXNlKCkmJidURVhUJz09PWIudHlwZS50b1VwcGVyQ2FzZSgpKSl7YS5wcmV2ZW50RGVmYXVsdCgpO319aWYoc2luay5vbktleWRvd24pc2luay5vbktleWRvd24oYSk7ZWxzZSBpZihzaW5rLmVtaXQpc2luay5lbWl0KCdrZXlkb3duJyxhKTt9O31wdXNoKGEpe3N0YWNrLnB1c2goe25hbWU6YX0pO3RoaXMuZW1pdCgnZm9jdXNlZCcsYSk7fXBvcCgpe2lmKHN0YWNrLmxlbmd0aCl7c3RhY2sucG9wKCk7Y29uc3QgYT1zdGFja1tzdGFjay5sZW5ndGgtMV07c2luaz1hLnNpbms7dGhpcy5lbWl0KCdmb2N1c2VkJyxhLm5hbWUpO319cmVnaXN0ZXIoYSxiKXtjb25zb2xlLmxvZygnZm9jdXMucmVnaXN0ZXInLGIpO3Npbms9c3RhY2tbc3RhY2subGVuZ3RoLTFdLnNpbms9YTt9fSkpO2Z1bmN0aW9uIG1peGluRm9jdXNhYmxlKGEpe3JldHVybiBjbGFzcyBleHRlbmRzIGF7Y29uc3RydWN0b3IoLi4uYil7c3VwZXIoLi4uYik7fWNvbXBvbmVudERpZE1vdW50KCl7Zm9jdXMucmVnaXN0ZXIodGhpcyx0aGlzLnByb3BzLm5hbWUpO31vbkdlc3R1cmUoYil7Y29uc29sZS5sb2coJ21peGluRm9jdXNhYmxlLm9uR2VzdHVyZScpO31vbktleWRvd24oYil7Y29uc29sZS5sb2coJ21peGluRm9jdXNhYmxlLm9uS2V5ZG93bicpO319fWNsYXNzIEZvY3VzZXIgZXh0ZW5kcyBDb21wb25lbnR7Y29uc3RydWN0b3IoYSl7c3VwZXIoYSk7dGhpcy5tYXA9YS5pdGVtcy5yZWR1Y2UoKGIsYyk9PihiW2MuYXR0cmlidXRlcy5uYW1lXT1jLGIpLHt9KTtmb2N1cy5vbignZm9jdXNlZCcsYj0+dGhpcy5zZXRTdGF0ZSh7Zm9jdXNlZDpifSkpO3RoaXMuc3RhdGU9e2ZvY3VzZWQ6YS5mb2N1c2VkfTt9cmVuZGVyKHt9LHtmb2N1c2VkOmF9KXtjb25zb2xlLmxvZygnRm9jdXNlci5yZW5kZXInLGEpO3JldHVybiB0aGlzLm1hcFthXX19XG5cbmV4cG9ydCB7IFRleHQsIFJvdywgQ29sLCBSb3dDb2xzLCBDb2xSb3dzLCBncmlkLCByb3csIHJvd3MsIGNvbCwgY29scywgQnV0dG9uLCBJY29uLCBSaXBwbGUsIFN3aXRjaCwgZm9jdXMsIG1peGluRm9jdXNhYmxlLCBGb2N1c2VyLCBjbGFzc2VzIH07XG4iLCJpbXBvcnQge2h9IGZyb20gJ3ByZWFjdCdcbmltcG9ydCB7QnV0dG9uLCBjbGFzc2VzfSBmcm9tICdAdGhlYXRlcnNvZnQvY29tcG9uZW50cydcblxuZXhwb3J0IGRlZmF1bHQgKHtsaWdodH0pID0+IHtcbiAgICBjb25zdCBpbnZlcnNlID0gIWxpZ2h0XG4gICAgcmV0dXJuIDxzZWN0aW9uIGNsYXNzPXtjbGFzc2VzKHtsaWdodH0pfT5cbiAgICAgICAgPEJ1dHRvbiBpY29uPVwiY3Jvc3NcIiBsYWJlbD1cIkZsYXRcIiBmbGF0IHsuLi57aW52ZXJzZX19Lz5cbiAgICAgICAgPEJ1dHRvbiBsYWJlbD1cIkZsYXRcIiBwcmltYXJ5IHsuLi57aW52ZXJzZX19Lz5cbiAgICAgICAgPEJ1dHRvbiBsYWJlbD1cIkZsYXRcIiBhY2NlbnQgey4uLntpbnZlcnNlfX0vPlxuICAgICAgICA8QnV0dG9uIGljb249XCJjcm9zc1wiIGxhYmVsPVwiUmFpc2VkXCIgcmFpc2VkIHsuLi57aW52ZXJzZX19Lz5cbiAgICAgICAgPEJ1dHRvbiBpY29uPVwiY3Jvc3NcIiBsYWJlbD1cIlByaW1hcnlcIiByYWlzZWQgcHJpbWFyeSB7Li4ue2ludmVyc2V9fS8+XG4gICAgICAgIDxCdXR0b24gbGFiZWw9XCJBY2NlbnRcIiByYWlzZWQgYWNjZW50IHsuLi57aW52ZXJzZX19Lz5cbiAgICAgICAgPEJ1dHRvbiBpY29uPVwiY3Jvc3NcIiBmbG9hdGluZyB7Li4ue2ludmVyc2V9fS8+XG4gICAgICAgIDxCdXR0b24gbGFiZWw9XCI4XCIgZmxvYXRpbmcgcHJpbWFyeSBtaW5pIHsuLi57aW52ZXJzZX19Lz5cbiAgICAgICAgPEJ1dHRvbiBpY29uPVwiY3Jvc3NcIiBmbG9hdGluZyBhY2NlbnQgbWluaSB7Li4ue2ludmVyc2V9fS8+XG4gICAgPC9zZWN0aW9uPlxufVxuIiwiaW1wb3J0IHtofSBmcm9tICdwcmVhY3QnXG5pbXBvcnQge0ljb259IGZyb20gJ0B0aGVhdGVyc29mdC9jb21wb25lbnRzJ1xuXG5leHBvcnQgZGVmYXVsdCAoKSA9PiAoXG4gICAgPHNlY3Rpb24+XG4gICAgICAgIDxJY29uIGljb249XCJhcnJvdy11cFwiLz5cbiAgICAgICAgPEljb24gaWNvbj1cImFycm93LWRvd25cIi8+XG4gICAgICAgIDxJY29uIGljb249XCJhcnJvdy11cFwiIHNtYWxsLz5cbiAgICAgICAgPEljb24gaWNvbj1cImFycm93LWRvd25cIiBzbWFsbC8+XG4gICAgPC9zZWN0aW9uPlxuKVxuIiwiaW1wb3J0IHtoLCBDb21wb25lbnR9IGZyb20gJ3ByZWFjdCdcbmltcG9ydCB7U3dpdGNofSBmcm9tICdAdGhlYXRlcnNvZnQvY29tcG9uZW50cydcblxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgZXh0ZW5kcyBDb21wb25lbnQge1xuICAgIHJlbmRlciAocCwge3N3fSkge1xuICAgICAgICByZXR1cm4gKFxuICAgICAgICAgICAgPHNlY3Rpb24+XG4gICAgICAgICAgICAgICAgPFN3aXRjaFxuICAgICAgICAgICAgICAgICAgICBjaGVja2VkPXtzd31cbiAgICAgICAgICAgICAgICAgICAgbGFiZWw9XCJTd2l0Y2hcIlxuICAgICAgICAgICAgICAgICAgICBvbkNoYW5nZT17dmFsdWUgPT4gdGhpcy5zZXRTdGF0ZSh7c3c6IHZhbHVlfSl9XG4gICAgICAgICAgICAgICAgLz5cbiAgICAgICAgICAgIDwvc2VjdGlvbj5cbiAgICAgICAgKVxuICAgIH1cbn1cbiIsImltcG9ydCB7aH0gZnJvbSAncHJlYWN0J1xuaW1wb3J0ICdAdGhlYXRlcnNvZnQvY29tcG9uZW50cy9jb21wb25lbnRzLmNzcydcbmltcG9ydCBCdXR0b24gZnJvbSAnLi9jb21wb25lbnRzL2J1dHRvbidcbmltcG9ydCBJY29uIGZyb20gJy4vY29tcG9uZW50cy9pY29uJ1xuaW1wb3J0IFN3aXRjaCBmcm9tICcuL2NvbXBvbmVudHMvc3dpdGNoJ1xuaW1wb3J0ICcuL0FwcC5zdHlsJ1xuXG5leHBvcnQgZGVmYXVsdCAoKSA9PiAoXG4gICAgPGRpdiBjbGFzcz1cInNjcm9sbFwiPlxuICAgICAgICA8U3dpdGNoLz5cbiAgICAgICAgPEljb24vPlxuICAgICAgICA8QnV0dG9uLz5cbiAgICAgICAgPEJ1dHRvbiBsaWdodC8+XG4gICAgICAgIDxCdXR0b24vPlxuICAgIDwvZGl2PlxuKVxuXG5cbiIsImltcG9ydCB7aCwgcmVuZGVyfSBmcm9tICdwcmVhY3QnXG5pbXBvcnQgJy4uLy4uL3NwZWMvc3JjL3Jlc2l6ZSdcbmltcG9ydCBBcHAgZnJvbSAnLi4vLi4vc3BlYy9zcmMvQXBwJ1xuaW1wb3J0ICcuL2luZGV4LnN0eWwnXG4vL2ltcG9ydCAnLi4vLi4vc3BlYy9yZXMvX2ljb25zLnN2ZydcblxucmVuZGVyKDxBcHAgLz4sIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCd1aScpKVxuIl0sIm5hbWVzIjpbImFyIiwicmVzaXplIiwiaHRtbCIsImRvY3VtZW50IiwiZG9jdW1lbnRFbGVtZW50IiwidyIsImNsaWVudFdpZHRoIiwiaCIsImNsaWVudEhlaWdodCIsImxhbmRzY2FwZSIsIndpZHRoIiwiTWF0aCIsImZsb29yIiwiaGVpZ2h0Iiwic3R5bGUiLCJmb250U2l6ZSIsImRpc3BsYXkiLCJib2R5IiwiY3NzVGV4dCIsIndpbmRvdyIsImFkZEV2ZW50TGlzdGVuZXIiLCJWTm9kZSIsInN0YWNrIiwiRU1QVFlfQ0hJTERSRU4iLCJub2RlTmFtZSIsImF0dHJpYnV0ZXMiLCJjaGlsZHJlbiIsImxhc3RTaW1wbGUiLCJjaGlsZCIsInNpbXBsZSIsImkiLCJhcmd1bWVudHMiLCJsZW5ndGgiLCJwdXNoIiwicG9wIiwidW5kZWZpbmVkIiwiU3RyaW5nIiwicCIsImtleSIsIm9wdGlvbnMiLCJ2bm9kZSIsImV4dGVuZCIsIm9iaiIsInByb3BzIiwiTk9fUkVOREVSIiwiU1lOQ19SRU5ERVIiLCJGT1JDRV9SRU5ERVIiLCJBU1lOQ19SRU5ERVIiLCJBVFRSX0tFWSIsIklTX05PTl9ESU1FTlNJT05BTCIsIml0ZW1zIiwiZW5xdWV1ZVJlbmRlciIsImNvbXBvbmVudCIsIl9kaXJ0eSIsImRlYm91bmNlUmVuZGVyaW5nIiwic2V0VGltZW91dCIsInJlcmVuZGVyIiwibGlzdCIsInJlbmRlckNvbXBvbmVudCIsImlzU2FtZU5vZGVUeXBlIiwibm9kZSIsImh5ZHJhdGluZyIsInNwbGl0VGV4dCIsIl9jb21wb25lbnRDb25zdHJ1Y3RvciIsImlzTmFtZWROb2RlIiwibm9ybWFsaXplZE5vZGVOYW1lIiwidG9Mb3dlckNhc2UiLCJnZXROb2RlUHJvcHMiLCJkZWZhdWx0UHJvcHMiLCJjcmVhdGVOb2RlIiwiaXNTdmciLCJjcmVhdGVFbGVtZW50TlMiLCJjcmVhdGVFbGVtZW50IiwicmVtb3ZlTm9kZSIsInBhcmVudE5vZGUiLCJyZW1vdmVDaGlsZCIsInNldEFjY2Vzc29yIiwibmFtZSIsIm9sZCIsInZhbHVlIiwiY2xhc3NOYW1lIiwidGVzdCIsImlubmVySFRNTCIsIl9faHRtbCIsInVzZUNhcHR1cmUiLCJyZXBsYWNlIiwic3Vic3RyaW5nIiwiZXZlbnRQcm94eSIsInJlbW92ZUV2ZW50TGlzdGVuZXIiLCJfbGlzdGVuZXJzIiwicmVtb3ZlQXR0cmlidXRlIiwibnMiLCJyZW1vdmVBdHRyaWJ1dGVOUyIsInNldEF0dHJpYnV0ZU5TIiwic2V0QXR0cmlidXRlIiwic2V0UHJvcGVydHkiLCJlIiwidHlwZSIsImV2ZW50IiwibW91bnRzIiwiZGlmZkxldmVsIiwiaXNTdmdNb2RlIiwiZmx1c2hNb3VudHMiLCJjIiwiYWZ0ZXJNb3VudCIsImNvbXBvbmVudERpZE1vdW50IiwiZGlmZiIsImRvbSIsImNvbnRleHQiLCJtb3VudEFsbCIsInBhcmVudCIsImNvbXBvbmVudFJvb3QiLCJvd25lclNWR0VsZW1lbnQiLCJyZXQiLCJpZGlmZiIsImFwcGVuZENoaWxkIiwib3V0IiwicHJldlN2Z01vZGUiLCJfY29tcG9uZW50Iiwibm9kZVZhbHVlIiwiY3JlYXRlVGV4dE5vZGUiLCJyZXBsYWNlQ2hpbGQiLCJidWlsZENvbXBvbmVudEZyb21WTm9kZSIsImZpcnN0Q2hpbGQiLCJmYyIsInZjaGlsZHJlbiIsIm5leHRTaWJsaW5nIiwiZGFuZ2Vyb3VzbHlTZXRJbm5lckhUTUwiLCJpbm5lckRpZmZOb2RlIiwiaXNIeWRyYXRpbmciLCJvcmlnaW5hbENoaWxkcmVuIiwiY2hpbGROb2RlcyIsImtleWVkIiwia2V5ZWRMZW4iLCJtaW4iLCJsZW4iLCJjaGlsZHJlbkxlbiIsInZsZW4iLCJqIiwidmNoaWxkIiwiX19rZXkiLCJ0cmltIiwiaW5zZXJ0QmVmb3JlIiwicmVjb2xsZWN0Tm9kZVRyZWUiLCJ1bm1vdW50T25seSIsInJlZiIsInJlbW92ZUNoaWxkcmVuIiwibGFzdENoaWxkIiwibmV4dCIsInByZXZpb3VzU2libGluZyIsImRpZmZBdHRyaWJ1dGVzIiwiYXR0cnMiLCJjb21wb25lbnRzIiwiY29sbGVjdENvbXBvbmVudCIsImNvbnN0cnVjdG9yIiwiY3JlYXRlQ29tcG9uZW50IiwiQ3RvciIsImluc3QiLCJwcm90b3R5cGUiLCJyZW5kZXIiLCJjYWxsIiwiQ29tcG9uZW50IiwiZG9SZW5kZXIiLCJuZXh0QmFzZSIsInNwbGljZSIsInN0YXRlIiwic2V0Q29tcG9uZW50UHJvcHMiLCJvcHRzIiwiX2Rpc2FibGUiLCJfX3JlZiIsImJhc2UiLCJjb21wb25lbnRXaWxsTW91bnQiLCJjb21wb25lbnRXaWxsUmVjZWl2ZVByb3BzIiwicHJldkNvbnRleHQiLCJwcmV2UHJvcHMiLCJzeW5jQ29tcG9uZW50VXBkYXRlcyIsImlzQ2hpbGQiLCJwcmV2aW91c1Byb3BzIiwicHJldmlvdXNTdGF0ZSIsInByZXZTdGF0ZSIsInByZXZpb3VzQ29udGV4dCIsImlzVXBkYXRlIiwiaW5pdGlhbEJhc2UiLCJpbml0aWFsQ2hpbGRDb21wb25lbnQiLCJza2lwIiwicmVuZGVyZWQiLCJjYmFzZSIsInNob3VsZENvbXBvbmVudFVwZGF0ZSIsImNvbXBvbmVudFdpbGxVcGRhdGUiLCJnZXRDaGlsZENvbnRleHQiLCJjaGlsZENvbXBvbmVudCIsInRvVW5tb3VudCIsImNoaWxkUHJvcHMiLCJfcGFyZW50Q29tcG9uZW50IiwiYmFzZVBhcmVudCIsImNvbXBvbmVudFJlZiIsInQiLCJ1bnNoaWZ0IiwiY29tcG9uZW50RGlkVXBkYXRlIiwiYWZ0ZXJVcGRhdGUiLCJfcmVuZGVyQ2FsbGJhY2tzIiwib3JpZ2luYWxDb21wb25lbnQiLCJvbGREb20iLCJpc0RpcmVjdE93bmVyIiwiaXNPd25lciIsInVubW91bnRDb21wb25lbnQiLCJiZWZvcmVVbm1vdW50IiwiY29tcG9uZW50V2lsbFVubW91bnQiLCJpbm5lciIsImNhbGxiYWNrIiwicyIsIkFycmF5IiwiY2xvbmUiLCJkZWx2ZSIsInNwbGl0IiwiaXNGdW5jdGlvbiIsImlzU3RyaW5nIiwiaGFzaFRvQ2xhc3NOYW1lIiwic3RyIiwicHJvcCIsImxjQ2FjaGUiLCJyZXNvbHZlZCIsIlByb21pc2UiLCJyZXNvbHZlIiwiZGVmZXIiLCJmIiwidGhlbiIsIkVNUFRZIiwiU3ltYm9sIiwiZm9yIiwiTk9OX0RJTUVOU0lPTl9QUk9QUyIsImJveEZsZXhHcm91cCIsImNvbHVtbkNvdW50IiwiZmlsbE9wYWNpdHkiLCJmbGV4IiwiZmxleEdyb3ciLCJmbGV4U2hyaW5rIiwiZmxleE5lZ2F0aXZlIiwiZm9udFdlaWdodCIsImxpbmVDbGFtcCIsImxpbmVIZWlnaHQiLCJvcmRlciIsIm9ycGhhbnMiLCJzdHJva2VPcGFjaXR5Iiwid2lkb3dzIiwiekluZGV4Iiwiem9vbSIsIk5PTl9CVUJCTElOR19FVkVOVFMiLCJibHVyIiwiZXJyb3IiLCJmb2N1cyIsImxvYWQiLCJzY3JvbGwiLCJjcmVhdGVMaW5rZWRTdGF0ZSIsImV2ZW50UGF0aCIsInBhdGgiLCJ0YXJnZXQiLCJ2IiwibWF0Y2giLCJjaGVja2VkIiwic2V0U3RhdGUiLCJpc0Z1bmN0aW9uYWxDb21wb25lbnQiLCJidWlsZEZ1bmN0aW9uYWxDb21wb25lbnQiLCJUZXh0IiwibCIsIm5vZGVzIiwiY29sbGVjdE5vZGUiLCJFbGVtZW50IiwiU1ZHRWxlbWVudCIsIm9yaWdpbmFsQXR0cmlidXRlcyIsImEiLCJyZW1vdmVPcnBoYW5lZENoaWxkcmVuIiwiY2IiLCJmbiIsInJlbW92ZSIsImNvbXBvbmVudERpZFVubW91bnQiLCJfbGlua2VkU3RhdGVzIiwiQmFzZSIsIm1peGluRXZlbnRFbWl0dGVyIiwiRXZlbnRFbWl0dGVyIiwiYXJncyIsImV2ZW50cyIsIk1hcCIsImhhcyIsInNldCIsImdldCIsImNhbGxiYWNrcyIsImZpbHRlciIsImZvckVhY2giLCJsb2ckMSIsImNvbnNvbGUiLCJsb2ciLCJiaW5kIiwiZXJyb3IkMSIsInRhZyIsImZvcm1hdCIsImxvZyQkMSIsImVycm9yJCQxIiwicHJveHkiLCJpbnRmIiwiZXhlYyIsIlByb3h5IiwiXyIsIm1lbWJlciIsIm1hbmFnZXIiLCJyZXNvbHZlTmFtZSIsInJlcXVlc3QiLCJtZXRob2RzIiwiT2JqZWN0IiwiZ2V0T3duUHJvcGVydHlOYW1lcyIsImdldFByb3RvdHlwZU9mIiwicGFyZW50U3RhcnR1cCIsIkNvbm5lY3Rpb25CYXNlIiwiYXV0aCIsIkFVVEgiLCJjb25uZWN0aW9uIiwib25oZWxsbyIsImhlbGxvIiwiZW1pdCIsIm9mZiIsIm9uYXV0aCIsInNlbmQiLCJvbiIsIkJyb3dzZXJDb25uZWN0aW9uIiwid3MiLCJzZWxmIiwib25vcGVuIiwib25tZXNzYWdlIiwiZXYiLCJKU09OIiwicGFyc2UiLCJkYXRhIiwib25jbG9zZSIsIm9uZXJyb3IiLCJzdHJpbmdpZnkiLCJQYXJlbnRDb25uZWN0aW9uIiwidXJsIiwibG9jYXRpb24iLCJwcm90b2NvbCIsImhvc3QiLCJFcnJvciIsImhhc1BhcmVudCIsImhhc0NoaWxkcmVuIiwiV2ViU29ja2V0IiwiTWFuYWdlciIsInJvb3QiLCJuYW1lcyIsInJlZ2lzdGVyT2JqZWN0Iiwic2VuZGVyIiwiYWRkTm9kZSIsInJlamVjdCIsImFsbCIsInNsaWNlIiwibWFwIiwicmVtb3ZlTmFtZSIsImRlbGV0ZSIsIl9zZW5kZXIiLCJhZGROYW1lIiwiaW5kZXhPZiIsImNoZWNrIiwibG9nUmVxdWVzdCIsInJlcSIsImlkIiwibG9nUmVzcG9uc2UiLCJyZXMiLCJoYXNPd25Qcm9wZXJ0eSIsImVyciIsIk5vZGUiLCJjb25ucyIsIm9iamVjdHMiLCJyZXFpZCIsInJlcXVlc3RzIiwic2lnbmFscyIsInN0YXR1cyIsInJlZ2lzdGVyZWQiLCJpbml0Iiwic2VydmVyIiwiY3JlYXRlU2VydmVyIiwiY29ubiIsImFkZENoaWxkIiwibWVzc2FnZSIsIm4iLCJsYXN0SW5kZXhPZiIsInIiLCJzdGFydHNXaXRoIiwicGFyc2VJbnQiLCJfcmVxdWVzdCIsInJlc3BvbnNlIiwic2lnIiwic2lnbmFsIiwicmVjb25uZWN0IiwiY2F0Y2giLCJtcyIsImNyZWF0ZVBhcmVudENvbm5lY3Rpb24iLCJrZXlzIiwicm91dGUiLCJpbmZvIiwibWV0YSIsImNvbmNhdCIsImZyb20iLCJleGVjdXRvciIsIl9yIiwiX2oiLCJzdGFydCIsImNsYXNzZXMiLCJiIiwiZCIsImVudHJpZXMiLCJqb2luIiwiSWNvbiIsImljb24iLCJzbWFsbCIsImNsYXNzIiwib25DbGljayIsImhyZWYiLCJmbGF0IiwicmFpc2VkIiwiaW52ZXJzZSIsImZsb2F0aW5nIiwibWluaSIsIm5ldXRyYWwiLCJwcmltYXJ5IiwiYWNjZW50Iiwic3R5bGUkMSIsInJpcHBsZVdyYXBwZXIiLCJyaXBwbGUiLCJyaXBwbGVSZXN0YXJ0aW5nIiwicmlwcGxlQWN0aXZlIiwiX2V4dGVuZHMiLCJhc3NpZ24iLCJzb3VyY2UiLCJvYmplY3RXaXRob3V0UHJvcGVydGllcyIsIm1vdXNlUG9zaXRpb24iLCJwYWdlWCIsInNjcm9sbFgiLCJwYWdlWE9mZnNldCIsInBhZ2VZIiwic2Nyb2xsWSIsInBhZ2VZT2Zmc2V0IiwidG91Y2hQb3NpdGlvbiIsInRvdWNoZXMiLCJyaXBwbGVGYWN0b3J5IiwiX3JlZiIsImNlbnRlcmVkIiwibXVsdGlwbGUiLCJzcHJlYWQiLCJnIiwiX2NsYXNzMiIsIl90ZW1wIiwicmlwcGxlcyIsInJpcHBsZU5vZGVzIiwiY3VycmVudENvdW50IiwiYWRkUmlwcGxlUmVtb3ZlRXZlbnRMaXN0ZW5lciIsImN1cnJlbnRLZXkiLCJ2YWx1ZXMiLCJlbmRSaXBwbGUiLCJtIiwicSIsInRvdWNoQ2FjaGUiLCJvIiwibGVmdCIsInRvcCIsInUiLCJnZXRCb3VuZGluZ0NsaWVudFJlY3QiLCJyaXBwbGVDZW50ZXJlZCIsInJpcHBsZVNwcmVhZCIsInoiLCJyaXBwbGVNdWx0aXBsZSIsImFkZFJpcHBsZURlYWN0aXZhdGVFdmVudExpc3RlbmVyIiwiYWN0aXZlIiwicmVzdGFydGluZyIsIkEiLCJwcm9wZXJ0eU5hbWUiLCJvblJpcHBsZUVuZGVkIiwiX3N0YXRlJHJpcHBsZXMiLCJ0cmFuc2Zvcm0iLCJfcmVmMiIsInJpcHBsZUNsYXNzIiwiZGlzYWJsZWQiLCJvbk1vdXNlRG93biIsImFuaW1hdGVSaXBwbGUiLCJvblRvdWNoU3RhcnQiLCJyZW5kZXJSaXBwbGUiLCJSaXBwbGUiLCJCdXR0b24iLCJsYWJlbCIsImsiLCJzdHlsZSQyIiwiZmllbGQiLCJ0aHVtYiIsInRodW1iRmFjdG9yeSIsInN3aXRjaEZhY3RvcnkiLCJoYW5kbGVUb2dnbGUiLCJvbkNoYW5nZSIsIlN3aXRjaCIsImNyZWF0ZUNvbW1vbmpzTW9kdWxlIiwibW9kdWxlIiwiZXhwb3J0cyIsImhhbW1lciIsIkMiLCJEIiwiSW5zdGFuY2UiLCJWRVJTSU9OIiwiZGVmYXVsdHMiLCJzdG9wX2Jyb3dzZXJfYmVoYXZpb3IiLCJ1c2VyU2VsZWN0IiwidG91Y2hBY3Rpb24iLCJ0b3VjaENhbGxvdXQiLCJjb250ZW50Wm9vbWluZyIsInVzZXJEcmFnIiwidGFwSGlnaGxpZ2h0Q29sb3IiLCJIQVNfUE9JTlRFUkVWRU5UUyIsIm5hdmlnYXRvciIsInBvaW50ZXJFbmFibGVkIiwibXNQb2ludGVyRW5hYmxlZCIsIkhBU19UT1VDSEVWRU5UUyIsIk1PQklMRV9SRUdFWCIsIk5PX01PVVNFRVZFTlRTIiwidXNlckFnZW50IiwiRVZFTlRfVFlQRVMiLCJVUERBVEVfVkVMT0NJVFlfSU5URVJWQUwiLCJET0NVTUVOVCIsImgkJDEiLCJESVJFQ1RJT05fRE9XTiIsIkRJUkVDVElPTl9MRUZUIiwiRElSRUNUSU9OX1VQIiwiRElSRUNUSU9OX1JJR0hUIiwiUE9JTlRFUl9NT1VTRSIsIlBPSU5URVJfVE9VQ0giLCJQT0lOVEVSX1BFTiIsIkVWRU5UX1NUQVJUIiwiRVZFTlRfTU9WRSIsIkVWRU5UX0VORCIsInBsdWdpbnMiLCJnZXN0dXJlcyIsIlJFQURZIiwiZGV0ZXJtaW5lRXZlbnRUeXBlcyIsImVhY2giLCJyZWdpc3RlciIsIm9uVG91Y2giLCJCIiwiZGV0ZWN0IiwidXRpbHMiLCJFIiwiRiIsIkciLCJIIiwiaW5TdHIiLCJnZXRDZW50ZXIiLCJJIiwiSiIsIm1heCIsImNsaWVudFgiLCJjbGllbnRZIiwiSyIsImFwcGx5IiwiZ2V0VmVsb2NpdHkiLCJ4IiwiYWJzIiwieSIsImdldEFuZ2xlIiwiYXRhbjIiLCJQSSIsImdldERpcmVjdGlvbiIsImdldERpc3RhbmNlIiwic3FydCIsImdldFNjYWxlIiwiZ2V0Um90YXRpb24iLCJpc1ZlcnRpY2FsIiwidG9nZ2xlRGVmYXVsdEJlaGF2aW9yIiwidG9VcHBlckNhc2UiLCJvbnNlbGVjdHN0YXJ0Iiwib25kcmFnc3RhcnQiLCJlbGVtZW50IiwiZW5hYmxlZCIsImV2ZW50U3RhcnRIYW5kbGVyIiwic3RhcnREZXRlY3QiLCJldmVudEhhbmRsZXJzIiwiZ2VzdHVyZSIsImhhbmRsZXIiLCJ0cmlnZ2VyIiwiY3JlYXRlRXZlbnQiLCJpbml0RXZlbnQiLCJkaXNwYXRjaEV2ZW50IiwiZW5hYmxlIiwiZGlzcG9zZSIsInVuYmluZERvbSIsImJpbmREb20iLCJ3aGljaCIsIkwiLCJ1cGRhdGVQb2ludGVyIiwiY29sbGVjdEV2ZW50RGF0YSIsImdldFRvdWNoTGlzdCIsInJlc2V0IiwiZ2V0RXZlbnRzIiwiaWRlbnRpZmllciIsIm1hdGNoVHlwZSIsImNlbnRlciIsInRpbWVTdGFtcCIsIkRhdGUiLCJub3ciLCJldmVudFR5cGUiLCJwb2ludGVyVHlwZSIsInNyY0V2ZW50IiwicHJldmVudERlZmF1bHQiLCJwcmV2ZW50TWFuaXB1bGF0aW9uIiwic3RvcFByb3BhZ2F0aW9uIiwic3RvcERldGVjdCIsIlBvaW50ZXJFdmVudCIsInBvaW50ZXJzIiwicG9pbnRlcklkIiwiZGV0ZWN0aW9uIiwiY3VycmVudCIsInByZXZpb3VzIiwic3RvcHBlZCIsInN0YXJ0RXZlbnQiLCJsYXN0RXZlbnQiLCJsYXN0VmVsb2NpdHlFdmVudCIsInZlbG9jaXR5IiwiZXh0ZW5kRXZlbnREYXRhIiwiZ2V0VmVsb2NpdHlEYXRhIiwidmVsb2NpdHlYIiwidmVsb2NpdHlZIiwiZ2V0SW50ZXJpbURhdGEiLCJpbnRlcmltQW5nbGUiLCJpbnRlcmltRGlyZWN0aW9uIiwiZGVsdGFUaW1lIiwiZGVsdGFYIiwiZGVsdGFZIiwiZGlzdGFuY2UiLCJhbmdsZSIsImRpcmVjdGlvbiIsInNjYWxlIiwicm90YXRpb24iLCJpbmRleCIsInNvcnQiLCJEcmFnIiwiZHJhZ19taW5fZGlzdGFuY2UiLCJjb3JyZWN0X2Zvcl9kcmFnX21pbl9kaXN0YW5jZSIsImRyYWdfbWF4X3RvdWNoZXMiLCJkcmFnX2Jsb2NrX2hvcml6b250YWwiLCJkcmFnX2Jsb2NrX3ZlcnRpY2FsIiwiZHJhZ19sb2NrX3RvX2F4aXMiLCJkcmFnX2xvY2tfbWluX2Rpc3RhbmNlIiwidHJpZ2dlcmVkIiwiZHJhZ19sb2NrZWRfdG9fYXhpcyIsIkhvbGQiLCJob2xkX3RpbWVvdXQiLCJob2xkX3RocmVzaG9sZCIsInRpbWVyIiwiUmVsZWFzZSIsIlN3aXBlIiwic3dpcGVfbWluX3RvdWNoZXMiLCJzd2lwZV9tYXhfdG91Y2hlcyIsInN3aXBlX3ZlbG9jaXR5IiwiVGFwIiwidGFwX21heF90b3VjaHRpbWUiLCJ0YXBfbWF4X2Rpc3RhbmNlIiwidGFwX2Fsd2F5cyIsImRvdWJsZXRhcF9kaXN0YW5jZSIsImRvdWJsZXRhcF9pbnRlcnZhbCIsImhhc19tb3ZlZCIsIm1vdmVkIiwiVG91Y2giLCJwcmV2ZW50X2RlZmF1bHQiLCJwcmV2ZW50X21vdXNlZXZlbnRzIiwiVHJhbnNmb3JtIiwidHJhbnNmb3JtX21pbl9zY2FsZSIsInRyYW5zZm9ybV9taW5fcm90YXRpb24iLCJ0cmFuc2Zvcm1fYWx3YXlzX2Jsb2NrIiwidHJhbnNmb3JtX3dpdGhpbl9pbnN0YW5jZSIsImRlZmluZSIsImFtZCIsIkhhbW1lciIsInNpbmsiLCJvbkdlc3R1cmUiLCJvbmtleWRvd24iLCJrZXlDb2RlIiwic3JjRWxlbWVudCIsInRhZ05hbWUiLCJvbktleWRvd24iLCJsaWdodCIsInN3IiwiZ2V0RWxlbWVudEJ5SWQiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQTtBQUNBLEFBQU8sU0FBUyxLQUFLLEdBQUcsRUFBRTs7QUNEMUI7Ozs7QUFJQSxjQUFlOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0NBc0JkLENBQUM7O0FDdEJGLE1BQU0sS0FBSyxHQUFHLEVBQUUsQ0FBQzs7QUFFakIsTUFBTSxjQUFjLEdBQUcsRUFBRSxDQUFDOzs7Ozs7O0FBTzFCLEFBQU8sU0FBUyxDQUFDLENBQUMsUUFBUSxFQUFFLFVBQVUsRUFBRTtDQUN2QyxJQUFJLFFBQVEsQ0FBQyxjQUFjLEVBQUUsVUFBVSxFQUFFLEtBQUssRUFBRSxNQUFNLEVBQUUsQ0FBQyxDQUFDO0NBQzFELEtBQUssQ0FBQyxDQUFDLFNBQVMsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxJQUFJO0VBQ25DLEtBQUssQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7RUFDekI7Q0FDRCxJQUFJLFVBQVUsSUFBSSxVQUFVLENBQUMsUUFBUSxFQUFFLElBQUksRUFBRTtFQUM1QyxJQUFJLENBQUMsS0FBSyxDQUFDLE1BQU0sRUFBRSxLQUFLLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxRQUFRLENBQUMsQ0FBQztFQUNuRCxPQUFPLFVBQVUsQ0FBQyxRQUFRLENBQUM7RUFDM0I7Q0FDRCxPQUFPLEtBQUssQ0FBQyxNQUFNLEVBQUU7RUFDcEIsSUFBSSxDQUFDLEtBQUssR0FBRyxLQUFLLENBQUMsR0FBRyxFQUFFLENBQUMsSUFBSSxLQUFLLENBQUMsR0FBRyxHQUFHLFNBQVMsRUFBRTtHQUNuRCxLQUFLLENBQUMsQ0FBQyxLQUFLLENBQUMsTUFBTSxF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N0I7TUFDSSxJQUFJLElBQUksR0FBRyxPQUFPLEVBQUU7RUFDeEIsSUFBSSxDQUFDLEtBQUssSUFBSSxPQUFPLEtBQUssR0FBRyxRQUFRLElBQUksT0FBTyxHQUFHLEdBQUcsUUFBUSxFQUFFO0dBQy9ELElBQUksQ0FBQyxLQUFLLENBQUMsT0FBTyxHQUFHLEtBQUssSUFBSSxFQUFFLENBQUM7R0FDakM7RUFDRCxJQUFJLEtBQUssSUFBSSxPQUFPLEtBQUssR0FBRyxRQUFRLEVBQUU7R0FDckMsSUFBSSxPQUFPLEdBQUcsR0FBRyxRQUFRLEVBQUU7SUFDMUIsS0FBSyxJQUFJLENBQUMsSUFBSSxHQUFHLEVBQUUsSUFBSSxDQUFDLENBQUMsQ0FBQyxJQUFJLEtBQUssQ0FBQyxFQUFFLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLEdBQUcsRUFBRSxDQUFDO0lBQ3pEO0dBQ0QsS0FBSyxJQUFJLENBQUMsSUFBSSxLQUFLLEVBQUU7SUFDcEIsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsR0FBRyxPQUFPLEtBQUssQ0FBQyxDQUFDLENBQUMsR0FBRyxRQUFRLElBQUksa0JBQWtCLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxHQUFHLEtBQUssR0FBRyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDOUc7R0FDRDtFQUNEO01BQ0ksSUFBSSxJQUFJLEdBQUcseUJBQXlCLEVBQUU7RUFDMUMsSUFBSSxLQUFLLEVBQUUsSUFBSSxDQUFDLFNBQVMsR0FBRyxLQUFLLENBQUMsTUFBTSxJQUFJLEVBQUUsQ0FBQztFQUMvQztNQUNJLElBQUksSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLEdBQUcsSUFBSSxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUUsR0FBRyxFQUFFO0VBQ3RDLElBQUksVUFBVSxHQUFHLElBQUksS0FBSyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLFVBQVUsRUFBRSxFQUFFLENB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
