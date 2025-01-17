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

	add(slug: string, quantity: number = 1)
	{
		this.items[slug] = (this.items[slug] || 0) + quantity
		return this;
	}

	remove(slug: string, quantity?: number)
	{
		const q = quantity ?? this.items[slug]
		this.items[slug] = Math.max(0, (this.items[slug] || 0) - q)
		if(this.items[slug] <= 0 || Number.isNaN(this.items[slug]))
		{
			delete this.items[slug]
		}
		return this;
	}

	get(slug: string)
	{
		return this.items[slug] || 0
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
		for(const slug of Object.values(this.items))
		{
			if(this.items[slug] <= 0 || Number.isNaN(this.items[slug]))
			{
				delete this.items[slug]
			}
		}
		return Object.entries(this.items).map(([slug, quantity]) => `${slug},${quantity}`).join(',')
	}

	async getProducts()
	{
		const products = await supabase.from("products").select("slug,name,price,image_url").in("slug", Object.keys(this.items))
		return products.data
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
			<link rel="stylesheet" href="/styles.css"/>
			<script src="/client.js" type="module"></script>
			<script src="/worker.js" type="module" defer></script>
			<meta name="description" content="VanillaMaster is a vanilla Javascript clone of NextMaster."/>
			{p.meta}
		</head>
		<body>
			<template shadowrootmode="open">
				<link rel="stylesheet" href="/styles.css"/>
				<loading-indicator background-color={"var(--primary-color)"}/>
				<slot name="header"/>
				<main>
					<slot name="main"/>
				</main>
				<slot name="footer"/>
			</template>
		</body>
		<Header cart={p.cart}/>
		<Footer/>
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
		<header slot="header" class="header-root">
			<a preload={"eager"} href="/" class="logo">VanillaMaster</a>
			<product-search>
				<input class="search" placeholder="Search..."></input>
			</product-search>
			<div class="menu-wrapper">
				<a href={"/cart"} class="order-link">CART</a>
				<span id="cart-indicator">{props.cart.length}</span>
			</div>
		</header>
	)
}

export const Footer = () => {
	return (
		<footer slot="footer">
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
			<set-title title={`VanillaMaster | ${data.name}`} />
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
			<set-title title={`VanillaMaster | ${organizedData?.[0].name}`}/>
			<div class="category-page">
				{organizedData.map((subcollection: any) => (
					<div class="category-wrapper">
						<h2>{subcollection.name}</h2>
						<ul>
							{subcollection.subcategories.map((subcategory: any) => (
								<li>
									<a preload class="hoverable"
									   href={`/products/${props.category}/${subcategory.slug}`}>
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
			<set-title title={`VanillaMaster | ${props.subcategory}`}/>
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
	if(!product.data) return <DefaultLayout><h1>Product not found</h1></DefaultLayout>
	return (
		<DefaultLayout>
			<set-title title={`VanillaMaster | ${product.data.name}`}/>
			<section class="product-page">
				<h1 class="title">{product?.data?.name}</h1>
				<div class="image-description">
					<img width={350} height={350} src={product.data.image_url} loading="eager"/>
					<p>{product.data.description}</p>
				</div>
				<p class="price">${product.data.price}</p>
				<add-to-cart>
					<form className="cart-form" method="post" action={"/cart/add"}>
						<input hidden name={"slug"} value={product.data.slug}/>
						<button className="add-to-cart">Add to cart</button>
					</form>
				</add-to-cart>
				<div class="related">
					<h3>Explore more Products</h3>
					<ul class='grid'>
						{relatedProducts.data?.map((product: any) => (
							<li>
								<a preload className="hoverable" href={`/product/${product.slug}`}>
									<img loading={"eager"} width={100} height={100} src={product.image_url}
										 alt={product.name}/>
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

async function CartPage(props: { cart: Cart })
{
	const products = await props.cart.getProducts();
	return (
		<DefaultLayout>
			<div class="cart-page">
				<h2>Cart</h2>
				<ul>
					{products?.map((product: any) => (
						<li class="product">
							<img width={100} height={100} src={product.image_url} alt={product.name}/>
							<div class='product-content'>
								<a preload href={"/product/" + product.slug}>{product.name}</a>
								<p>{props.cart.get(product.slug)} · ${(product.price * props.cart.get(product.slug)).toFixed(2)}</p>
								<div class="forms">
									<form method="post" action="/cart/add">
										<input hidden name="slug" value={product.slug}/>
										<input hidden type="number" name="quantity" value={1}/>
										<button>➕</button>
									</form>
									<form method="post" action="/cart/remove">
										<input hidden name="slug" value={product.slug}/>
										<input hidden type="number" name="quantity" value={1}/>
										<button>➖</button>
									</form>
									<form method="post" action="/cart/remove">
										<input hidden name="slug" value={product.slug}/>
										<button>🗑</button>
									</form>
								</div>
							</div>
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
	const meta = <>
		<title>VanillaMaster</title>
	</>
	return stream(c, async s => {
		s.write("<!DOCTYPE html>");
		s.write(await render(c, <Shell cart={Cart.FromContext(c)} meta={meta}></Shell>));
		s.write(await render(c, <HomePage/>));
	});
});

app.get("/products/:category/:subcategory", (c) => {
	const meta = <>
		<title>VanillaMaster | Products</title>
	</>
	return stream(c, async s => {
		s.write("<!DOCTYPE html>");
		s.write(await render(c, <Shell cart={Cart.FromContext(c)} meta={meta}></Shell>));
		s.write(await render(c, <SubcategoryPage subcategory={c.req.param("subcategory")} />));
	})
});

app.get("/products/:category", (c) =>
{
	const meta = <>
		<title>VanillaMaster | Products</title>
	</>
	return stream(c, async s => {
		s.write("<!DOCTYPE html>");
		s.write(await render(c, <Shell cart={Cart.FromContext(c)} meta={meta}></Shell>));
		s.write(await render(c, <CategoryPage category={c.req.param("category")} />));
	})
});

app.get("/collections/:collection", (c) =>
{
	const meta = <>
		<title>VanillaMaster | Products</title>
	</>
	return stream(c, async s => {
		s.write("<!DOCTYPE html>");
		s.write(await render(c, <Shell cart={Cart.FromContext(c)} meta={meta}></Shell>));
		s.write(await render(c, <CollectionPage collection={c.req.param("collection")} />));
	})
});

app.get("/product/:product", (c) =>
{
	const meta = <>
		<title>VanillaMaster | Product</title>
	</>
	return stream(c, async s => {
		s.write("<!DOCTYPE html>");
		s.write(await render(c, <Shell cart={Cart.FromContext(c)} meta={meta}></Shell>));
		s.write(await render(c, <ProductPage product={c.req.param("product")} />));
	})
});

app.get("/search/:query", async (c) =>
{
	try {
		const cleanQuery = c.req.param('query').trim().replace(/\s+/g, ' & ');

		if (!cleanQuery) return c.json({ data: [], error: null });


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

app.post("/cart/add", async (c) =>
{
	const cart = getCookie(c, 'cart');
	const formData = await c.req.parseBody();
	const slug = String(formData.slug);
	const quantity = Number(formData.quantity ?? '1');
	const cartObj = new Cart();
	cartObj.parse(cart);
	cartObj.add(slug, quantity);
	setCookie(c, "cart", cartObj.stringify());
	if(c.req.header("x-wants-json") === "please") return c.json({ success: true, cart: cartObj.items });
	else return c.redirect("/cart");
})

app.post("/cart/remove", async (c) =>
{
	const cart = getCookie(c, 'cart');
	const formData = await c.req.parseBody();
	const slug = String(formData.slug);
	const quantity = Number(formData.quantity);
	const cartObj = new Cart();
	cartObj.parse(cart);
	cartObj.remove(slug, quantity);
	setCookie(c, "cart", cartObj.stringify());
	if(c.req.header("x-wants-json") === "please") return c.json({ success: true, cart: cartObj.items });
	else return c.redirect("/cart");
})

app.get("/cart", (c) => {
	const cart = getCookie(c, 'cart')
	if(!cart) setCookie(c, "cart", "")
	const cartObj = new Cart().parse(cart)
	const meta = <>
		<title>VanillaMaster | Cart</title>
	</>
	return stream(c, async s => {
		s.write("<!DOCTYPE html>");
		s.write(await render(c, <Shell cart={Cart.FromContext(c)} meta={meta}></Shell>));
		s.write(await render(c, <CartPage cart={cartObj}/>));
	})
})

app.use("/client.js", serveStatic({ path: "./client.js" }));
app.use("/worker.js", serveStatic({ path: "./worker.js" }));
app.use("*", serveStatic({ root: "./static" }));

export default { fetch: app.fetch };
