import puppeteer from 'puppeteer';
import * as cheerio from 'cheerio';
import validatorMainnetSubscriptionSchema from '../schema/trackedMainnetValidator.js';
import { notifyUsers } from './notificationUtils.js';
import { currentEpoch } from './epochPoller.js';

const MAX_CONCURRENCY = 30;

async function withConcurrencyLimit(tasks, limit) {
  let index = 0;
  const results = [];

  async function runNext() {
    if (index >= tasks.length) return;
    const i = index++;
    try {
      results[i] = await tasks[i]();
    } catch (e) {
      results[i] = e;
    }
    await runNext();
  }

  const runners = [];
  for (let i = 0; i < Math.min(limit, tasks.length); i++) {
    runners.push(runNext());
  }
  await Promise.all(runners);
  return results;
}

async function fetchValidatorData(browser, validatorVoteAddress, epoch, maxBucket) {
    const page = await browser.newPage();
    try {
        if (!maxBucket) {
            const baseUrl = `https://app.vx.tools/vote-history/${validatorVoteAddress}/epoch/${epoch}`;
            await page.goto(baseUrl, { waitUntil: 'networkidle0' });
            const firstPageHtml = await page.content();
            const $first = cheerio.load(firstPageHtml);
            let tmpMaxBucket = -1;
            let maxLink = null;
            $first('table').first().find('tr').each((_, row) => {
                const tds = $first(row).find('td');
                if (tds.length >= 2) {
                    const bucketNum = parseInt($first(tds[0]).text().trim(), 10);
                    if (!isNaN(bucketNum) && bucketNum > tmpMaxBucket) {
                        const aTag = $first(tds[1]).find('a');
                        if (aTag.length) {
                            tmpMaxBucket = bucketNum;
                            maxLink = aTag.attr('href');
                        }
                    }
                }
            });
            if (!maxLink) throw new Error(`Largest bucket link not found for validator ${validatorVoteAddress}`);
            maxBucket = tmpMaxBucket;
        }

        const bucketUrl = `https://app.vx.tools/vote-history/${validatorVoteAddress}/epoch/${epoch}/bucket/${maxBucket}`;
        await page.goto(bucketUrl, { timeout: 45000, waitUntil: 'networkidle2' });
        const bucketHtml = await page.content();
        const $bucket = cheerio.load(bucketHtml);

        const credits = [];
        $bucket('table').first().find('tr').each((_, row) => {
            const tds = $bucket(row).find('td');
            if (tds.length >= 4) {
                const creditText = $bucket(tds[3]).text().trim();
                const creditVal = parseFloat(creditText);
                if (!isNaN(creditVal)) credits.push(creditVal);
            }
        });
        if(credits.length < 200) return { maxBucket, bucketUrl, hasLowCredit: false, last200Credits: credits };
        const last200Credits = credits.slice(-200);
        const hasLowCredit = last200Credits.every(c => c < 16);

        return { maxBucket, bucketUrl, hasLowCredit, last200Credits };

    } catch (err) {
        console.error(`Error fetching data for ${validatorVoteAddress}:`, err);
        return { error: err.message || 'Unknown error' };
    } finally {
        await page.close();
    }
}

async function getMaxBucket(browser, validatorVoteAddress, epoch) {
    const page = await browser.newPage();
    try {
        const baseUrl = `https://app.vx.tools/vote-history/${validatorVoteAddress}/epoch/${epoch}`;
        await page.goto(baseUrl, { waitUntil: 'networkidle0' });
        const html = await page.content();
        const $ = cheerio.load(html);

        let maxBucket = -1;
        $('table').first().find('tr').each((_, row) => {
            const tds = $(row).find('td');
            if (tds.length >= 2) {
                const bucketNum = parseInt($(tds[0]).text().trim(), 10);
                if (!isNaN(bucketNum) && bucketNum > maxBucket) {
                    maxBucket = bucketNum;
                }
            }
        });
        if (maxBucket === -1) {
            console.error(`Failed to find maxBucket for validator ${validatorVoteAddress}`);
            return
        }
        return maxBucket;
    } finally {
        await page.close();
    }
}
export async function trackValidatorsVoteCredits() {
    const validators = await validatorMainnetSubscriptionSchema.find().lean();
    if (validators.length === 0) {
        console.log('No validators found for vote credit tracking.');
        return;
    }

    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const maxBucket = await getMaxBucket(browser, validators[0].validatorVoteAddress, currentEpoch.mainnet);
	
    if(maxBucket === -1) {
        await browser.close();
        return;
    }

    const tasks = validators.map(v => async () => {
        try {
            console.log(`fetching vote credits for ${v.validatorVoteAddress}`)
            const data = await fetchValidatorData(browser, v.validatorVoteAddress, currentEpoch.mainnet, maxBucket);
            if (!data || data.error) return;
            if (data.hasLowCredit !== v.lastVoteStatus) {
                const messageData = {
                    hasLowCredit: data.hasLowCredit
                };
                await notifyUsers(v.discordSubscriptions, v.tgSubscriptions, v.validatorVoteAddress, 'voteCredit', messageData);

                await validatorMainnetSubscriptionSchema.updateOne(
                    { validatorVoteAddress: v.validatorVoteAddress },
                    { $set: { lastVoteStatus: data.hasLowCredit } }
                );
            }
        } catch (e) {
            console.error(`Validator processing error ${v.validatorVoteAddress}:`, e);
        }
    });

    await withConcurrencyLimit(tasks, MAX_CONCURRENCY);

    await browser.close();
}
