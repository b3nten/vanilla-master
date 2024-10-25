/***********************************************************
    Polyfill for browsers that do not support requestIdleCallback
************************************************************/

if (!window.requestIdleCallback) {
	window.requestIdleCallback = function (callback, options) {
		var options = options || {};
		var relaxation = 1;
		var timeout = options.timeout || relaxation;
		var start = performance.now();
		return setTimeout(function () {
			callback({
				get didTimeout() {
					return options.timeout ? false : (performance.now() - start) - relaxation > timeout;
				},
				timeRemaining: function () {
					return Math.max(0, relaxation + (performance.now() - start));
				},
			});
		}, relaxation);
	};
}

/***********************************************************
    Utilities
************************************************************/

function debounce(func, timeout = 300){
	let timer;
	return (...args) => {
		clearTimeout(timer);
		timer = setTimeout(() => { func.apply(this, args) }, timeout);
	}
}

const tick = (callback) => setTimeout(() => requestAnimationFrame(callback));

const randomRange = (min, max) => Math.floor(Math.random() * (max - min + 1) + min);

class Task {
	constructor(task)
	{
		let rejected = false;
		const { promise, resolve, reject } = Promise.withResolvers();
		this.#promise = promise;
		this.#reject = reject;
		if (!rejected)
		{
			task().then(resolve, reject)
		}
	}

	then(...args) { return this.#promise.then(...args); }

	cancel()
	{
		this.#reject(new Error("Canceled"));
	}

	#reject;
	#promise;
}

class LoadingIndicator extends HTMLElement
{

	static observedAttributes = ['background-color'];

	attributeChangedCallback(name, oldValue, newValue) {
		if(name === "background-color")
		{
			this.style.backgroundColor = newValue;
		}
	}

	static BeginLoading()
	{
		window.dispatchEvent(new Event("begin-loading"));
	}

	static EndLoading()
	{
		window.dispatchEvent(new Event("end-loading"));
	}

	tasks = []

	beginLoading = () =>
	{
		this.style.transition = "all 0.001s";
		this.style.opacity = "1";
		this.style.transform = "scaleX(0)";

		this.tasks.push(
			setTimeout(() =>{
				this.style.transition = "all 1s";
				this.style.transform = "scaleX(.4)";
				this.style.opacity = "1";
			}, 50),
			setTimeout(() => {
				this.style.transition = "all .5s";
				this.style.transform = "scaleX(.6)";
			}, randomRange(500, 900)),
			setTimeout(() => {
				this.style.transform = "scaleX(.7)";
			}, randomRange(1000, 1500)),
			setTimeout(() => {
				this.style.transform = "scaleX(.8)";
			}, randomRange(2500, 3500)),
			setTimeout(() => {
				this.style.transform = "scaleX(.85)";
			}, randomRange(4000, 5000)),
			setTimeout(() => {
				this.style.transform = "scaleX(.9)";
			}, randomRange(6000, 7000)),
		)
	}

	endLoading = () =>
	{
		this.#clearTasks();
		this.tasks.push(
			setTimeout(() =>
			{
				this.style.transition = "all .75s ease";
				this.style.transform = "scaleX(1)";
			}, 100),
			setTimeout(() => {
				this.style.opacity = "0";
			}, 300)
		)
	}

	connectedCallback()
	{
		this.#createStyles();
		window.addEventListener("begin-loading", this.beginLoading);
		window.addEventListener("end-loading", this.endLoading);
	}

	disconnectedCallback()
	{
		window.removeEventListener("begin-loading", this.beginLoading);
		window.removeEventListener("end-loading", this.endLoading);
	}

	#tasks = [];

	#clearTasks()
	{
		this.tasks.forEach(clearTimeout)
		this.tasks.length = 0;
	}

	#createStyles()
	{
		this.style.position = "fixed";
		this.style.top = "0";
		this.style.left = "0";
		this.style.width = "100%";
		this.style.height = "5px";
		this.style.backgroundColor = "black";
		this.style.transition = "all 1s";
		this.style.transform = "scaleX(1)";
		this.style.transformOrigin = "left";
		this.style.opacity = "0";
		this.id = "loader";
	}
}

if(!customElements.get("loading-indicator")) customElements.define("loading-indicator", LoadingIndicator);

/***********************************************************
    Morpher
 	* Uses idiomorph for prefetching links and images and morphing the page
************************************************************/

class Morpher
{
	static s_PageCache = new Map();

	static Preload(url)
	{
		if(Morpher.s_PageCache.has(url)) return Morpher.s_PageCache.get(url);

		Morpher.s_PageCache.set(url, fetch(url, { headers: { "x-morphframe": 'true' }})
			.then(response => response.text()));

		return Morpher.s_PageCache.get(url);
	}

	static {
		if(typeof window !== "undefined") {
			globalThis.Idiomorph=function(){"use strict";let o=new Set;let n={morphStyle:"outerHTML",callbacks:{beforeNodeAdded:t,afterNodeAdded:t,beforeNodeMorphed:t,afterNodeMorphed:t,beforeNodeRemoved:t,afterNodeRemoved:t,beforeAttributeUpdated:t},head:{style:"merge",shouldPreserve:function(e){return e.getAttribute("im-preserve")==="true"},shouldReAppend:function(e){return e.getAttribute("im-re-append")==="true"},shouldRemove:t,afterHeadMorphed:t}};function e(e,t,n={}){if(e instanceof Document){e=e.documentElement}if(typeof t==="string"){t=k(t)}let l=y(t);let r=p(e,l,n);return a(e,l,r)}function a(r,i,o){if(o.head.block){let t=r.querySelector("head");let n=i.querySelector("head");if(t&&n){let e=c(n,t,o);Promise.all(e).then(function(){a(r,i,Object.assign(o,{head:{block:false,ignore:true}}))});return}}if(o.morphStyle==="innerHTML"){l(i,r,o);return r.children}else if(o.morphStyle==="outerHTML"||o.morphStyle==null){let e=M(i,r,o);let t=e?.previousSibling;let n=e?.nextSibling;let l=d(r,e,o);if(e){return N(t,l,n)}else{return[]}}else{throw"Do not understand how to morph style "+o.morphStyle}}function u(e,t){return t.ignoreActiveValue&&e===document.activeElement}function d(e,t,n){if(n.ignoreActive&&e===document.activeElement){}else if(t==null){if(n.callbacks.beforeNodeRemoved(e)===false)return e;e.remove();n.callbacks.afterNodeRemoved(e);return null}else if(!g(e,t)){if(n.callbacks.beforeNodeRemoved(e)===false)return e;if(n.callbacks.beforeNodeAdded(t)===false)return e;e.parentElement.replaceChild(t,e);n.callbacks.afterNodeAdded(t);n.callbacks.afterNodeRemoved(e);return t}else{if(n.callbacks.beforeNodeMorphed(e,t)===false)return e;if(e instanceof HTMLHeadElement&&n.head.ignore){}else if(e instanceof HTMLHeadElement&&n.head.style!=="morph"){c(t,e,n)}else{r(t,e,n);if(!u(e,n)){l(t,e,n)}}n.callbacks.afterNodeMorphed(e,t);return e}}function l(n,l,r){let i=n.firstChild;let o=l.firstChild;let a;while(i){a=i;i=a.nextSibling;if(o==null){if(r.callbacks.beforeNodeAdded(a)===false)return;l.appendChild(a);r.callbacks.afterNodeAdded(a);H(r,a);continue}if(b(a,o,r)){d(o,a,r);o=o.nextSibling;H(r,a);continue}let e=A(n,l,a,o,r);if(e){o=v(o,e,r);d(e,a,r);H(r,a);continue}let t=S(n,l,a,o,r);if(t){o=v(o,t,r);d(t,a,r);H(r,a);continue}if(r.callbacks.beforeNodeAdded(a)===false)return;l.insertBefore(a,o);r.callbacks.afterNodeAdded(a);H(r,a)}while(o!==null){let e=o;o=o.nextSibling;T(e,r)}}function f(e,t,n,l){if(e==="value"&&l.ignoreActiveValue&&t===document.activeElement){return true}return l.callbacks.beforeAttributeUpdated(e,t,n)===false}function r(t,n,l){let e=t.nodeType;if(e===1){const r=t.attributes;const i=n.attributes;for(const o of r){if(f(o.name,n,"update",l)){continue}if(n.getAttribute(o.name)!==o.value){n.setAttribute(o.name,o.value)}}for(let e=i.length-1;0<=e;e--){const a=i[e];if(f(a.name,n,"remove",l)){continue}if(!t.hasAttribute(a.name)){n.removeAttribute(a.name)}}}if(e===8||e===3){if(n.nodeValue!==t.nodeValue){n.nodeValue=t.nodeValue}}if(!u(n,l)){s(t,n,l)}}function i(t,n,l,r){if(t[l]!==n[l]){let e=f(l,n,"update",r);if(!e){n[l]=t[l]}if(t[l]){if(!e){n.setAttribute(l,t[l])}}else{if(!f(l,n,"remove",r)){n.removeAttribute(l)}}}}function s(n,l,r){if(n instanceof HTMLInputElement&&l instanceof HTMLInputElement&&n.type!=="file"){let e=n.value;let t=l.value;i(n,l,"checked",r);i(n,l,"disabled",r);if(!n.hasAttribute("value")){if(!f("value",l,"remove",r)){l.value="";l.removeAttribute("value")}}else if(e!==t){if(!f("value",l,"update",r)){l.setAttribute("value",e);l.value=e}}}else if(n instanceof HTMLOptionElement){i(n,l,"selected",r)}else if(n instanceof HTMLTextAreaElement&&l instanceof HTMLTextAreaElement){let e=n.value;let t=l.value;if(f("value",l,"update",r)){return}if(e!==t){l.value=e}if(l.firstChild&&l.firstChild.nodeValue!==e){l.firstChild.nodeValue=e}}}function c(e,t,l){let r=[];let i=[];let o=[];let a=[];let u=l.head.style;let d=new Map;for(const n of e.children){d.set(n.outerHTML,n)}for(const s of t.children){let e=d.has(s.outerHTML);let t=l.head.shouldReAppend(s);let n=l.head.shouldPreserve(s);if(e||n){if(t){i.push(s)}else{d.delete(s.outerHTML);o.push(s)}}else{if(u==="append"){if(t){i.push(s);a.push(s)}}else{if(l.head.shouldRemove(s)!==false){i.push(s)}}}}a.push(...d.values());m("to append: ",a);let f=[];for(const c of a){m("adding: ",c);let n=document.createRange().createContextualFragment(c.outerHTML).firstChild;m(n);if(l.callbacks.beforeNodeAdded(n)!==false){if(n.href||n.src){let t=null;let e=new Promise(function(e){t=e});n.addEventListener("load",function(){t()});f.push(e)}t.appendChild(n);l.callbacks.afterNodeAdded(n);r.push(n)}}for(const h of i){if(l.callbacks.beforeNodeRemoved(h)!==false){t.removeChild(h);l.callbacks.afterNodeRemoved(h)}}l.head.afterHeadMorphed(t,{added:r,kept:o,removed:i});return f}function m(){}function t(){}function h(e){let t={};Object.assign(t,n);Object.assign(t,e);t.callbacks={};Object.assign(t.callbacks,n.callbacks);Object.assign(t.callbacks,e.callbacks);t.head={};Object.assign(t.head,n.head);Object.assign(t.head,e.head);return t}function p(e,t,n){n=h(n);return{target:e,newContent:t,config:n,morphStyle:n.morphStyle,ignoreActive:n.ignoreActive,ignoreActiveValue:n.ignoreActiveValue,idMap:C(e,t),deadIds:new Set,callbacks:n.callbacks,head:n.head}}function b(e,t,n){if(e==null||t==null){return false}if(e.nodeType===t.nodeType&&e.tagName===t.tagName){if(e.id!==""&&e.id===t.id){return true}else{return L(n,e,t)>0}}return false}function g(e,t){if(e==null||t==null){return false}return e.nodeType===t.nodeType&&e.tagName===t.tagName}function v(t,e,n){while(t!==e){let e=t;t=t.nextSibling;T(e,n)}H(n,e);return e.nextSibling}function A(n,e,l,r,i){let o=L(i,l,e);let t=null;if(o>0){let e=r;let t=0;while(e!=null){if(b(l,e,i)){return e}t+=L(i,e,n);if(t>o){return null}e=e.nextSibling}}return t}function S(e,t,n,l,r){let i=l;let o=n.nextSibling;let a=0;while(i!=null){if(L(r,i,e)>0){return null}if(g(n,i)){return i}if(g(o,i)){a++;o=o.nextSibling;if(a>=2){return null}}i=i.nextSibling}return i}function k(n){let l=new DOMParser;let e=n.replace(/<svg(\s[^>]*>|>)([\s\S]*?)<\/svg>/gim,"");if(e.match(/<\/html>/)||e.match(/<\/head>/)||e.match(/<\/body>/)){let t=l.parseFromString(n,"text/html");if(e.match(/<\/html>/)){t.generatedByIdiomorph=true;return t}else{let e=t.firstChild;if(e){e.generatedByIdiomorph=true;return e}else{return null}}}else{let e=l.parseFromString("<body><template>"+n+"</template></body>","text/html");let t=e.body.querySelector("template").content;t.generatedByIdiomorph=true;return t}}function y(e){if(e==null){const t=document.createElement("div");return t}else if(e.generatedByIdiomorph){return e}else if(e instanceof Node){const t=document.createElement("div");t.append(e);return t}else{const t=document.createElement("div");for(const n of[...e]){t.append(n)}return t}}function N(e,t,n){let l=[];let r=[];while(e!=null){l.push(e);e=e.previousSibling}while(l.length>0){let e=l.pop();r.push(e);t.parentElement.insertBefore(e,t)}r.push(t);while(n!=null){l.push(n);r.push(n);n=n.nextSibling}while(l.length>0){t.parentElement.insertBefore(l.pop(),t.nextSibling)}return r}function M(e,t,n){let l;l=e.firstChild;let r=l;let i=0;while(l){let e=w(l,t,n);if(e>i){r=l;i=e}l=l.nextSibling}return r}function w(e,t,n){if(g(e,t)){return.5+L(n,e,t)}return 0}function T(e,t){H(t,e);if(t.callbacks.beforeNodeRemoved(e)===false)return;e.remove();t.callbacks.afterNodeRemoved(e)}function E(e,t){return!e.deadIds.has(t)}function x(e,t,n){let l=e.idMap.get(n)||o;return l.has(t)}function H(e,t){let n=e.idMap.get(t)||o;for(const l of n){e.deadIds.add(l)}}function L(e,t,n){let l=e.idMap.get(t)||o;let r=0;for(const i of l){if(E(e,i)&&x(e,i,n)){++r}}return r}function R(e,n){let l=e.parentElement;let t=e.querySelectorAll("[id]");for(const r of t){let t=r;while(t!==l&&t!=null){let e=n.get(t);if(e==null){e=new Set;n.set(t,e)}e.add(r.id);t=t.parentElement}}}function C(e,t){let n=new Map;R(e,n);R(t,n);return n}return{morph:e,defaults:n}}();
		}
	}

	mutationObserver;

	intersectObserver;

	getFromCache(url)
	{
		if(Morpher.s_PageCache.has(url)) return Morpher.s_PageCache.get(url);
		Morpher.s_PageCache.set(url, fetch(url, { headers: { "x-morphframe": 'true' }})
			.then(response => response.text()));
		return Morpher.s_PageCache.get(url);
	}

	registerLink(element)
	{
		const strategy = element.getAttribute("preload");

		if(typeof strategy === "undefined" || strategy === null) return;

		const url = element.href;

		if(strategy === "eager" && !Morpher.s_PageCache.has(url))
			this.getFromCache(url)
		else if (strategy === "hover" && Morpher.s_PageCache.has(url))
			element.addEventListener("mouseenter", () => {
				this.getFromCache(url)
			})
		else if (!Morpher.s_PageCache.has(url))
			this.intersectObserver.observe(element);

		if(!element.hasSPAEventAdded)
		{
			element.addEventListener("click", async (e) => {

				e.preventDefault();

				LoadingIndicator.BeginLoading();

				const url = element.href;

				history.pushState({ url }, "", url);

				const response = await this.getFromCache(url);

				try {
					if(location.href === url)
					{
						this.morph(response);
						setTimeout(() => requestAnimationFrame(() => window.scroll(0, 0)));
					}
				}
				catch (e) {}

				LoadingIndicator.EndLoading();
			})

			element.addEventListener("pointerenter", () => {
				this.getFromCache(url).then((r) => {
					this.preloadImages(r);
				})
			})

			element.hasSPAEventAdded = true;
		}
	}

	preloadImages(content)
	{
		const template = document.createElement("template");
		template.innerHTML = content;
		const images = template.content.querySelectorAll("img");
		for(const img of images)
		{
			if(img.getAttribute("preload") === "eager")
			{
				new Image().src = img.src;
			}
		}
	}

	init()
	{
		if(!this.intersectObserver)
		{
			this.intersectObserver = new IntersectionObserver((entries) => {
				for(const entry of entries)
				{
					if(entry.isIntersecting)
					{
						const url = entry.target.href;
						this.getFromCache(url);
					}
				}
			})
		}

		if(!this.mutationObserver)
		{
			this.mutationObserver = new MutationObserver((mutations) => {
				for(const mut of mutations)
				{
					for(const n of mut.addedNodes)
					{
						const add = (node) => {
							if(node.tagName === "A") this.registerLink(node);
							if(node.children) for(const child of node.children) add(child);
						}
						add(n);
					}
				}
			})
		}

		this.mutationObserver.observe(document.body, { childList: true, subtree: true });

		for(const link of document.getElementsByTagName("a")) this.registerLink(link);
		for(const link of document.body.shadowRoot.querySelectorAll("a")) this.registerLink(link);

		window.addEventListener("popstate", async (event) => {
			event.preventDefault()
			const url = event.target.location.pathname;
			const response = await this.getFromCache(url);
			this.morph(response);
		});
	}

	morph(result)
	{
		const template = document.createElement("template");
		template.innerHTML = result;
		const main = template.content.querySelector("[slot=main]");
		if(main)
		{
			Idiomorph.morph(document.querySelector("[slot=main]"), main, );
		}
	}
}

const morpher = new Morpher;
morpher.init()

/***********************************************************
 	Search element
************************************************************/

class SearchElement extends HTMLElement
{
	input;
	value;
	results;
	dropdown;
	inFlightPromise;
	debouncedOnInput;

	onInput = (e) =>
	{
		this.value = this.input.value;

		if(this.value.length < 3)
		{
			this.dropdown.innerHTML = "Search products...";
		}
		else
		{
			this.fetchFromServer();
		}
	}

	fetchFromServer = async () =>
	{
		if(this.inFlightPromise) this.inFlightPromise.cancel();

		this.dropdown.innerHTML = "Loading...";

		this.inFlightPromise = new Task(async () => {
			const res = await fetch(`/search/${this.value}`);
			if(!res.ok) return;
			this.results = await res.json();
			return this.results.data;
		})

		this.inFlightPromise.then((results) => {
			if(!results || results.length === 0) {
				this.dropdown.innerHTML = "No results found";
				return;
			}

			this.results = results;
			this.dropdown.innerHTML = this.results.map(r => `<a preload class="search-result hoverable" href="/product/${r.slug}">${r.name}</a>`).join("")
			for(const link of this.dropdown.getElementsByTagName("a"))
			{
				morpher.registerLink(link);
				link.addEventListener("click", (e) => {
					this.dropdown.style.display = "none";
				})
			}
		}).catch(e => {
			if(e.message === "Canceled") return;
			console.error("error fetching search results:", e);
		})
	}

	connectedCallback()
	{
		this.style.position = "relative";

		this.input = this.querySelector("input");

		this.debouncedOnInput = debounce(this.onInput);

		this.input.addEventListener("input", (e) => this.debouncedOnInput(e))

		document.body.shadowRoot.addEventListener("click", (e) => {
			if(!this.contains(e.target)) this.dropdown.style.display = "none";
		})

		this.input.addEventListener("focus", () => {
			this.dropdown.style.display = "block";
		})

		this.dropdown = document.createElement("div");
		this.dropdown.classList.add("search-dropdown");
		this.dropdown.innerHTML = "Search products...";
		this.appendChild(this.dropdown);
	}
}

if(!customElements.get("product-search")) customElements.define("product-search", SearchElement);

class OptimisticCartAdder extends HTMLElement
{
	form;

	increment()
	{
		const indicator = document.body.querySelector("#cart-indicator");
		if(!indicator) return;
		indicator.innerHTML = String(parseInt(indicator.innerHTML) + 1);
	}

	decrement()
	{
		const indicator = document.body.querySelector("#cart-indicator");
		if(!indicator) return;
		indicator.innerHTML = String(Math.max(0, Number(indicator.innerHTML) - 1));
	}

	onSubmit = async (e) =>
	{
		e.preventDefault();
		this.increment()
		const fd = new FormData(this.form);
		const res = await fetch("/cart/add", {
			method: "POST",
			body: fd,
			headers: { 'x-wants-json': 'please' }
		})
		if(!res.ok) return this.decrement();
		const cart = await res.json();
		if(cart.error) this.decrement();
	}

	connectedCallback()
	{
		this.form = this.querySelector("form");
		this.form.addEventListener("submit", this.onSubmit);
	}

	disconnectedCallback()
	{
		this.form.removeEventListener("submit", this.onSubmit);
	}
}

if(!customElements.get("add-to-cart")) customElements.define("add-to-cart", OptimisticCartAdder);

export class SetTitle extends HTMLElement
{
	static observedAttributes = ['title'];

	attributeChangedCallback(name, oldValue, newValue) {
		if(name === "title")
		{
			document.title = newValue;
		}
	}
}

if(!customElements.get("set-title")) customElements.define("set-title", SetTitle);