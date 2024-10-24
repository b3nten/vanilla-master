import "jsr:@std/dotenv/load";
import { Hono } from "hono";
import { serveStatic } from "hono/deno";
import { PropsWithChildren } from "hono/jsx";
import { stream } from "hono/streaming"
import { getCookie, setCookie } from 'hono/cookie'
import { createClient } from 'jsr:@supabase/supabase-js@2'

const render = async (c: any, component: any) => await (await c.html(component)).text()

const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_KEY")!)

/***********************************************************
    Data Objects
 ************************************************************/

interface Collection
{
	id: number
	name: string
	slug: string
}

interface Category
{
	collection_id: number
	name: string
	slug: string
	image_url: string
}

interface SubCollection
{
	id: number
	category_slug: string
	name: string
}

interface SubCategory
{
	subcollection_id: number
	name: string
	slug: string
	image_url: string
}

interface Product
{
	slug: string
	name: string
	description: string
	price: number
	subcategory_slug: string
	image_url: string
}

class Cart
{
	static FromContext(c: any)
	{
		return new Cart().parse(getCookie(c, 'cart') ?? "")
	}

	items: Record<string, number> = {}

	get length()
	{
		return Object.entries(this.items).reduce((acc, [_, quantity]) => acc + quantity, 0)
	}

	add(slug: string, quantity: number)
	{
		this.items[slug] = (this.items[slug] || 0) + quantity
		return this;
	}

	remove(slug: string, quantity: number)
	{
		this.items[slug] = Math.max(0, (this.items[slug] || 0) - quantity)
		if(this.items[slug] <= 0)
		{
			delete this.items[slug]
		}
		return this;
	}

	get(slug: string)
	{
		return this.items[slug] || 0
	}

	adjust(slug: string, quantity: number)
	{
		this.items[slug] = quantity
		if(this.items[slug] <= 0)
		{
			delete this.items[slug]
		}
		return this;
	}

	parse(cart?: string)
	{
		if(!cart) return this;
		const items = cart.split(',')
		for(let i = 0; i < items.length; i += 2)
		{
			this.items[items[i]] = parseInt(items[i + 1])
		}
		return this;
	}

	stringify()
	{
		for(const [slug, quantity] of Object.entries(this.items))
		{
			if(quantity <= 0)
			{
				delete this.items[slug]
			}
		}
		return Object.entries(this.items).map(([slug, quantity]) => `${slug},${quantity}`).join(',')
	}
}

/***********************************************************
    Static shell
************************************************************/

const Shell = (p: PropsWithChildren<{ meta: any, cart: Cart }>) => (
	<html lang="en">
		<head>
			<meta charset="utf-8"/>
			<meta name="viewport" content="width=device-width, initial-scale=1"/>
			<title>Hello world</title>
			<link rel="stylesheet" href="/styles.css"/>
			<script src="/client.js" type="module"></script>
			<script src="/worker.js" type="module" defer></script>
		</head>
		<body>
			<template id="lol" shadowrootmode="open">
				<div id="loader" className="loader"/>
				<link rel="stylesheet" href="/styles.css"/>
				<Header cart={p.cart}/>
				<main>
					<slot name="main"/>
				</main>
				<Footer/>
			</template>
		</body>
		{p.children}
	</html>
)

/***********************************************************
    Default Layout
 ************************************************************/

export const DefaultLayout = async (props: PropsWithChildren) => {
	const c = await supabase.from("collections").select("name, slug");
	return (
		<div class="default-layout" slot="main">
			<aside class="sidebar-nav">
				<h2>Choose a Collection</h2>
				{c.data?.map((collection: any) => (
					<a class={'hoverable'} preload href={`/collections/${collection.slug}`}>{collection.name}</a>))}
			</aside>
			<div class="content">{props.children}</div>
		</div>
	)
}

export const Header = (props: { cart: Cart }) => {
	return (
		<header class="header-root">
			<a preload={"eager"} href="/" class="logo">VanillaMaster</a>
			<product-search>
				<input class="search" placeholder="Search..."></input>
			</product-search>
			<div class="menu-wrapper">
				<a class="order-link">ORDER</a>
				<span>{props.cart.length}</span>
				<a class="order-history-link">ORDER HISTORY</a>
			</div>
		</header>
	)
}

export const Footer = () => {
	return (
		<footer>
			<ul>
				<li>Home</li>
				<li>Location</li>
				<li>Returns</li>
				<li>Careers</li>
				<li>Mobile App</li>
				<li>Solidworks Add-In</li>
				<li>Help</li>
				<li>Settings</li>
			</ul>
			<p>By using this website, you agree to check out the <a href="http://github.com/b3nten/vanilla-master">Source Code</a></p>
		</footer>
	)
}

/***********************************************************
	Home Page
 ************************************************************/

export const HomePage = async () => {

	const c = await supabase.from("collections").select(`name, slug, categories:categories(*)`);

	let imageCount = 0;

	return (
		<DefaultLayout>
			<div class="home">
				{c.data?.map((collection: any) => (
					<div>
						<h2>{collection.name}</h2>
						<div class="collection-wrapper">
							{collection.categories.map((category: any) => (
								<a preload href={`/products/${category.slug}`}>
									<img loading={imageCount++ > 30 ? "lazy" : 'eager'} width={100} height={100} src={category.image_url}
										 alt={category.name}/>
									<p>{category.name}</p>
								</a>
							))}
						</div>
					</div>
				))}
			</div>
		</DefaultLayout>
	)
}

/***********************************************************
    Collection Page
************************************************************/

export const CollectionPage = async (props: { collection: string }) => {
	// all categories in collection
	const { data } = await supabase.from("collections").select("*, categories:categories(*)").eq("slug", props.collection).single()
	return (
		<DefaultLayout>
			<div class="collection-page">
				<div>
					<h2>{data.name}</h2>
					<div className="collection-wrapper">
						{data.categories.map((category: any) => (
							<a preload href={`/products/${category.slug}`}>
								<img loading={"eager"} width={100} height={100} src={category.image_url}
									 alt={category.name}/>
								<p>{category.name}</p>
							</a>
						))}
					</div>
				</div>
			</div>
		</DefaultLayout>
	)
}

/***********************************************************
    Category Page
 ************************************************************/

export const CategoryPage = async (props: { category: string }) => {
	const subcollections = await supabase.from("subcollections").select("*").eq("category_slug", props.category)

	const {data: subcategories} = await supabase
		.from('subcategories')
		.select("*").in("subcollection_id", subcollections.data!.map((x: any) => x.id));

	const organizedData = subcollections.data!.map(subcollection => ({
		...subcollection,
		subcategories: subcategories!.filter(
			subcat => subcat.subcollection_id === subcollection.id
		)
	}));

	return (
		<DefaultLayout>
			<div class="category-page">
				{organizedData.map((subcollection: any) => (
					<div class="category-wrapper">
						<h2>{subcollection.name}</h2>
						<ul>
							{subcollection.subcategories.map((subcategory: any) => (
								<li>
									<a preload class="hoverable" href={`/products/${props.category}/${subcategory.slug}`}>
										<img loading={"lazy"} width={100} height={100} src={subcategory.image_url}
											 alt={subcategory.name}/>
										<p>{subcategory.name}</p>
									</a>
								</li>
							))}
						</ul>
					</div>
				))}
			</div>
		</DefaultLayout>
	)
}

/***********************************************************
	Subcategory Page
 ************************************************************/

export const SubcategoryPage = async (props: { subcategory: string }) => {
	const products = await supabase.from("products").select("*").eq("subcategory_slug", props.subcategory)
	return (
		<DefaultLayout>
			<div className='subcategory-page'>
				<div className="category-wrapper">
					<ul>
						{products.data?.map((subcategory: any) => (
							<li>
								<a preload className="hoverable" href={`/product/${subcategory.slug}`}>
									<img loading={"lazy"} width={100} height={100} src={subcategory.image_url}
										 alt={subcategory.name}/>
									<p>{subcategory.name}</p>
								</a>
							</li>
						))}
					</ul>
				</div>
			</div>
		</DefaultLayout>
	)
}

/***********************************************************
	Product Page
 ************************************************************/

export const ProductPage = async (props: { product: string }) => {
	const product = (await supabase.from("products").select("*").eq("slug", props.product).single()) as { data: Product }
	const relatedProducts = await supabase.from("products").select("*").neq("slug", props.product).limit(6)
	return (
		<DefaultLayout>
			<section class="product-page">
				<h1 class="title">{product.data.name}</h1>
				<div class="image-description">
					<img width={350} height={350} src={product.data.image_url} loading="eager" />
					<p>{product.data.description}</p>
				</div>
				<p class="price">${product.data.price}</p>
				<form class="cart-form" method="post" action={"/cart/add"}>
					<input hidden name={"slug"} value={product.data.slug}/>
					<button class="add-to-cart">Add to cart</button>
				</form>
				<div class="related">
					<h3>Explore more Products</h3>
					<ul class='grid'>
						{relatedProducts.data?.map((product: any) => (
							<li>
								<a preload className="hoverable" href={`/product/${product.slug}`}>
									<img loading={"eager"} width={100} height={100} src={product.image_url} alt={product.name}/>
									<p>{product.name}</p>
								</a>
							</li>
						))}
					</ul>
				</div>
			</section>
		</DefaultLayout>
	)
}

/***********************************************************
    Cart Page
************************************************************/

function CartPage(props: { cart: Cart })
{
	return (
		<DefaultLayout>
			<div class="cart-page">
				<h2>Cart</h2>
				<ul>
					{Object.entries(props.cart.items).map(([slug, quantity]) => (
						<li>
							<p>{slug}</p>
							<p>{quantity}</p>
							<form method="post" action="/cart/adjust">
								<input hidden name="slug" value={slug}/>
								<input hidden type="number" name="quantity" value={quantity + 1}/>
								<button>+</button>
							</form>
							<form method="post" action="/cart/adjust">
								<input hidden name="slug" value={slug}/>
								<input hidden type="number" name="quantity" value={Math.max(0, quantity - 1)}/>
								<button>-</button>
							</form>
							<form method="post" action="/cart/remove">
								<input hidden name="slug" value={slug}/>
								<input hidden name="quantity" value={quantity}/>
								<button>Remove</button>
							</form>
						</li>
					))}
				</ul>
			</div>
		</DefaultLayout>
	)
}

/***********************************************************
    Application instantiation.
 ************************************************************/

const app = new Hono();

app.get("/", (c) => {
	// get meta info
	const meta = {}
	return stream(c, async s => {
		s.write("<!DOCTYPE html>");
		s.write(await render(c, <Shell cart={Cart.FromContext(c)} meta={meta}></Shell>));
		s.write(await render(c, <HomePage/>));
	});
});

app.get("/products/:category/:subcategory", (c) =>
{
	const meta = {}
	return c.html(<Shell cart={Cart.FromContext(c)} meta={meta}><SubcategoryPage subcategory={c.req.param("subcategory")} /></Shell>)
});

app.get("/products/:category", (c) =>
{
	const meta = {}
	return c.html(<Shell cart={Cart.FromContext(c)} meta={meta}><CategoryPage category={c.req.param("category")} /></Shell>)
});

app.get("/collections/:collection", (c) =>
{
	const meta = {}
	return c.html(<Shell cart={Cart.FromContext(c)} meta={meta}><CollectionPage collection={c.req.param("collection")} /></Shell>)
});

app.get("/product/:product", (c) =>
{
	const meta = {}
	return c.html(<Shell cart={Cart.FromContext(c)} meta={meta}><ProductPage product={c.req.param("product")} /></Shell>)
});

app.get("/search/:query", async (c) =>
{
	await new Promise((resolve) => setTimeout(resolve, 500));
	try {
		// Clean and prepare the search query
		const cleanQuery = c.req.param('query').trim().replace(/\s+/g, ' & ');

		// If query is empty, return early
		if (!cleanQuery) {
			return c.json({ data: [], error: null });
		}

		// Perform the search with multiple approaches and combine results
		const { data, error } = await supabase
			.from('products')
			.select('name, slug, image_url')
			.textSearch('search_vector', cleanQuery)
			.limit(10);

		if (error) {
			console.error('Search error:', error);
			return c.json({ data: null, error });
		}
		return c.json({ data, error: null });
	} catch (error) {
		console.error('Unexpected error:', error);
		return c.json({ data: null, error });
	}
})

app.post("/cart/add", async (c) => {
	const cart = getCookie(c, 'cart')
	const formData = await c.req.parseBody()
	const slug = String(formData.slug)
	const quantity = Number(formData.quantity ?? '1')
	const cartObj = new Cart()
	cartObj.parse(cart)
	cartObj.add(slug, quantity)
	setCookie(c, "cart", cartObj.stringify())
	return c.redirect("/cart")
})

app.post("/cart/remove", async (c) => {
	const cart = getCookie(c, 'cart')
	const formData = await c.req.parseBody()
	const slug = String(formData.slug)
	const quantity = Number(formData.quantity ?? '1')
	const cartObj = new Cart()
	cartObj.parse(cart)
	cartObj.remove(slug, quantity)
	setCookie(c, "cart", cartObj.stringify())
	return c.redirect("/cart")
})

app.post("/cart/adjust", async (c) => {
	const cart = getCookie(c, 'cart')
	const formData = await c.req.parseBody()
	const slug = String(formData.slug)
	const quantity = Number(formData.quantity ?? '1')
	const cartObj = new Cart()
	cartObj.parse(cart)
	cartObj.adjust(slug, quantity)
	setCookie(c, "cart", cartObj.stringify())
	return c.redirect("/cart")
})

app.get("/cart", (c) => {
	const cart = getCookie(c, 'cart')
	if(!cart){
		setCookie(c, "cart", "")
	}
	const cartObj = new Cart()
	cartObj.parse(cart)
	const meta = {}
	return c.html(<Shell cart={Cart.FromContext(c)} meta={meta}><CartPage cart={cartObj}/></Shell>)
})

app.use("/client.js", serveStatic({ path: "./client.js" }));
app.use("/worker.js", serveStatic({ path: "./worker.js" }));
app.use("*", serveStatic({ root: "./static" }));

export default { fetch: app.fetch };
