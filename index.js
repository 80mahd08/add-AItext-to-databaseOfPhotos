require("dotenv").config();
const { createClient } = require("pexels");
const jimp = require("jimp");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const sleep = (ms) => {
	return new Promise((resolve) => {
		setTimeout(() => {
			resolve();
		}, ms);
	});
};

if (!process.env.GOOGLE_API_KEY || !process.env.PEXELS_API_KEY) {
	console.error("API keys are missing. Please check your .env file.");
	process.exit(1); // Exit the application if API keys are missing
}

const googleAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
const generativeModel = googleAI.getGenerativeModel({
	model: "gemini-1.5-flash",
});

const pexelsClient = createClient(process.env.PEXELS_API_KEY);

const query = "space";
const numberOfPages = 50;
const quotePrompt =
	"Generate a unique and inspirational motivational quote. Please format the output as follows: 'quote'";

async function generateQuote(prompt) {
	let attempts = 0;
	while (attempts < 5) {
		try {
			const res = await generativeModel.generateContent(prompt);
			return res.response.text();
		} catch (error) {
			attempts++;
			if (error.status === 429) {
				console.error(`Rate limit hit, retrying in ${attempts * 2} seconds...`);
				await sleep(attempts * 2000);
			} else {
				console.error("Error generating quote:", error);
				return null;
			}
		}
	}
	console.error("Failed to generate quote after multiple attempts.");
	return null;
}

async function processPhoto(photo) {
	try {
		const image = await jimp.read(photo.src.large);
		const font = await jimp.loadFont(
			"./public/RUfBYNqSi8LNcUcdvR9BtaAA.ttf.fnt"
		); // Load Lobster-Regular font
		let quote = await generateQuote(quotePrompt);
		if (quote) {
			quote = quoteStyle(quote);
			// Maintain aspect ratio while resizing
			image.resize(1920, jimp.AUTO);
			const scaledHeight = image.bitmap.height;

			// Draw a semi-transparent rectangle behind the text for better visibility
			const textWidth = 1800; // Maximum width of the text
			const textHeight = jimp.measureTextHeight(font, quote, textWidth);
			const x = (image.bitmap.width - textWidth) / 2;
			const y = (scaledHeight - textHeight) / 2;

			// Adding a semi-transparent background for the text
			image.color([{ apply: "shade", params: [50] }]); // Optional: Darken the image for better text contrast
			image.print(
				font,
				x,
				y,
				{
					text: quote,
					alignmentX: jimp.HORIZONTAL_ALIGN_CENTER,
					alignmentY: jimp.VERTICAL_ALIGN_MIDDLE,
				},
				textWidth,
				textHeight
			);

			await image.writeAsync(`./images/${photo.id}.jpg`);
			console.log(`Image ${photo.id} processed successfully.`);
		}
	} catch (error) {
		console.error(`Error processing photo ${photo.id}:`, error);
	}
}

pexelsClient.photos
	.search({ query, per_page: numberOfPages })
	.then((photos) => {
		if (photos && photos.photos) {
			photos.photos.forEach((photo) => {
				processPhoto(photo);
			});
		} else {
			console.error("No photos found.");
		}
	})
	.catch((error) => {
		console.error("Error searching photos:", error);
	});

function quoteStyle(x) {
	if (!x) {
		return "";
	}
	let xArray = x.split(" ");
	if (xArray.length > 15) {
		let out = "";
		xArray.forEach((element, index) => {
			if (index !== 0 && index % 15 === 0) {
				out += "\n";
			}
			out += element + " ";
		});
		return out.trim();
	} else {
		return x;
	}
}
