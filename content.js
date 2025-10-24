const server = 'https://gmgnhelper.lcd.finance';

// Initialize default settings
let settings = {
  userId: '',
  connected: false
};

// Load saved settings
chrome.storage.sync.get(['userId', 'connected'], function (items) {
  settings = items;
  if (settings.connected) {
    initializeButtons();
  }
});

// Listen for settings changes
chrome.storage.onChanged.addListener(function (changes) {
  if (changes.connected) {
    console.log('connection status changed');
    settings.connected = changes.connected.newValue;
    if (settings.connected) {
      initializeButtons();
    } else {
      removeAllButtons();
    }
  }
  if (changes.userId) {
    console.log('userId changed');
    settings.userId = changes.userId.newValue;
  }
});

// Remove all buttons
function removeAllButtons() {
  document.querySelectorAll('.gmgn-helper-button-container, .gmgn-helper-trading-buttons').forEach(el => el.remove());
}

// Initialize buttons for all matching elements
function initializeButtons() {
  if (!settings.connected) return;
  createButtonsForExistingElements();
  createTradingPageButtons();
  observeDOMChanges();
}

// Create buttons for existing elements
function createButtonsForExistingElements() {
  const newPairsHeader = Array.from(document.querySelectorAll('.flex.items-center.gap-2.whitespace-nowrap.text-\\[14px\\].font-medium'))
    .find(el => el.textContent === 'New');

  if (!newPairsHeader) return;

  const newPairsSection = newPairsHeader.closest('.flex.flex-1.flex-col');
  if (!newPairsSection) return;

  const tokenElements = newPairsSection.querySelectorAll('.relative.flex.overflow-hidden.w-full.text-sm.cursor-pointer');

  tokenElements.forEach(element => {
    if (!settings.connected) return;
    // if (!element.getAttribute('href').startsWith('/bsc/token/')) return;
    const bsc = document.querySelector('.flex.items-center.gap-6px.cursor-pointer').getElementsByTagName('img')[0].getAttribute('src');
    if (bsc !== '/static/img/bsc.svg') return;
    addButtonsToElement(element);
  });
}

// Create buttons for trading page
function createTradingPageButtons() {
  if (!settings.connected) return;

  const bsc = document.querySelector('.flex.items-center.gap-6px.cursor-pointer').getElementsByTagName('img')[0].getAttribute('src');
  if (bsc !== '/static/img/bsc.svg') return;

  const tradingPageContainer = document.querySelector('.flex.items-center.pl-16px.h-\\[70px\\].bg-bg-100.overflow-auto.gap-40px.border-b-\\[1px\\].border-b-line-100.justify-start');
  if (!tradingPageContainer || tradingPageContainer.querySelector('.gmgn-helper-trading-buttons')) return;

  const tradingButtonsContainer = document.createElement('div');
  tradingButtonsContainer.className = 'gmgn-helper-trading-buttons flex flex-row gap-[8px] items-center ml-auto';

  const devSellButton = document.createElement('button');
  devSellButton.className = 'gmgn-helper-button gmgn-helper-buy text-[10px]';
  devSellButton.textContent = 'DEV SELL';

  const lastSellButton = document.createElement('button');
  lastSellButton.className = 'gmgn-helper-button gmgn-helper-sell text-[10px]';
  lastSellButton.textContent = 'LAST SELL';

  const cancelButton = document.createElement('button');
  cancelButton.className = 'gmgn-helper-button text-[10px]';
  cancelButton.style.backgroundColor = '#f26682';
  cancelButton.textContent = 'CANCEL';

  const tokenAddress = window.location.pathname.split('/').pop();

  devSellButton.addEventListener('click', (e) => handleTradingButtonClick(e, 'devSell', tokenAddress));
  lastSellButton.addEventListener('click', (e) => handleTradingButtonClick(e, 'lastSell', tokenAddress));
  cancelButton.addEventListener('click', (e) => handleTradingButtonClick(e, 'cancel', tokenAddress));

  tradingButtonsContainer.appendChild(devSellButton);
  tradingButtonsContainer.appendChild(lastSellButton);
  tradingButtonsContainer.appendChild(cancelButton);

  const lastButtonGroup = tradingPageContainer.querySelector('.flex.flex-row.flex-1.gap-\\[12px\\].justify-end');
  if (lastButtonGroup) {
    lastButtonGroup.insertBefore(tradingButtonsContainer, lastButtonGroup.firstChild);
  } else {
    tradingPageContainer.appendChild(tradingButtonsContainer);
  }
}

// Handle trading page button clicks
async function handleTradingButtonClick(event, action, tokenAddress) {
  const button = event.currentTarget;
  button.classList.add('gmgn-helper-button-pulse');

  try {
    const metadata = await tokenMetadata(tokenAddress);
    if (metadata.creatorStatus !== 'creator_hold' && metadata.creatorStatus !== 'creator_buy' && metadata.creatorStatus !== 'creator_sell') {
      if (action !== 'cancel') {
        alert('Dev Sold already!');
        return;
      }
    }

    if (metadata.quote !== '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c') {
      alert('The quote token is not BNB, please select another token');
      return;
    }

    const backendRes = await fetch(`${server}/order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        userId: settings?.userId,
        tokenAddress: tokenAddress,
        name: metadata.name,
        symbol: metadata.symbol,
        logo: metadata.logo,
        totalSupply: metadata.totalSupply,
        creator: metadata.creator,
        creatorBalance: metadata.creatorBalance,
        orderType: action
      })
    });

    if (!backendRes.ok) {
      throw new Error(`Backend response failed: HTTP ${backendRes.status}`);
    }

    const backendData = await backendRes.json();
    if (!backendData.status) {
      alert(backendData.message);
    }
  } catch (error) {
    console.error('Error in trading button flow:', error.message || error);
  } finally {
    // Always remove the animation
    setTimeout(() => {
      button.classList.remove('gmgn-helper-button-pulse');
    }, 400);
  }
}

// Add buttons to a single element
function addButtonsToElement(element) {
  if (!settings.connected || element.querySelector('.gmgn-helper-button-container')) {
    return;
  }

  const buttonContainer = document.createElement('div');
  buttonContainer.className = 'gmgn-helper-button-container';

  const devSellButton = document.createElement('button');
  devSellButton.className = 'gmgn-helper-button gmgn-helper-buy';
  devSellButton.textContent = 'DEV SELL';

  const lastSellButton = document.createElement('button');
  lastSellButton.className = 'gmgn-helper-button gmgn-helper-sell';
  lastSellButton.textContent = 'LAST SELL';

  devSellButton.addEventListener('click', (e) => handleButtonClick(e, 'devSell', element));
  lastSellButton.addEventListener('click', (e) => handleButtonClick(e, 'lastSell', element));

  buttonContainer.appendChild(devSellButton);
  buttonContainer.appendChild(lastSellButton);

  if (getComputedStyle(element).position === 'static') {
    element.style.position = 'relative';
  }

  element.appendChild(buttonContainer);
}

// Handle button clicks
async function handleButtonClick(event, action, element) {

  try {

    event.preventDefault();
    event.stopPropagation();

    const button = event.currentTarget;
    button.classList.add('gmgn-helper-button-pulse');

    const tokenAddress = extractTokenInfo(element);

    const metadata = await tokenMetadata(tokenAddress);

    if (metadata.creatorStatus !== 'creator_hold' && metadata.creatorStatus !== 'creator_buy' && metadata.creatorStatus !== 'creator_sell') {
      alert('Dev Sold already!');
      return;
    }

    if (metadata.quote !== '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c') {
      alert('The quote token is not BNB, please select another token');
      return;
    }

    const backendRes = await fetch(`${server}/order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        userId: settings?.userId,
        tokenAddress: tokenAddress,
        name: metadata.name,
        symbol: metadata.symbol,
        logo: metadata.logo,
        totalSupply: metadata.totalSupply,
        creator: metadata.creator,
        creatorBalance: metadata.creatorBalance,
        orderType: action
      })
    });

    if (!backendRes.ok) {
      throw new Error(`Backend response failed: HTTP ${backendRes.status}`);
    }

    const backendData = await backendRes.json();
    if (!backendData.status) {
      alert(backendData.message);
    }
  } catch (error) {
    console.error('Error in button click:', error.message || error);
  } finally {
    setTimeout(() => {
      button.classList.remove('gmgn-helper-button-pulse');
    }, 400);
  }
}

// Extract token information including address
function extractTokenInfo(element) {
  if (!element) return null;
  const tokenAddress = element.getAttribute('href').split('/').pop();

  return tokenAddress;
}

// Set up MutationObserver to handle dynamically added content
function observeDOMChanges() {
  const targetNode = document.body;

  const observer = new MutationObserver(function (mutations) {
    let shouldCheckForNewElements = false;

    mutations.forEach(mutation => {
      if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
        shouldCheckForNewElements = true;
      }
    });

    if (shouldCheckForNewElements && settings.connected) {
      createButtonsForExistingElements();
      createTradingPageButtons();
    }
  });

  observer.observe(targetNode, {
    childList: true,
    subtree: true
  });
}

async function tokenMetadata(tokenAddress) {
  const tokenInfoRes = await fetch(`https://gmgn.ai/api/v1/mutil_window_token_info`, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Origin': 'https://gmgn.ai',
      'Referer': 'https://gmgn.ai',
    },
    body: JSON.stringify({
      addresses: [tokenAddress],
      chain: 'bsc',
    })
  });
  if (!tokenInfoRes.ok) {
    throw new Error(`Token info request failed: HTTP ${tokenInfoRes.status}`);
  }
  const data = await tokenInfoRes.json();
  return {
    tokenAddress: data.data[0].address,
    logo: data.data[0].logo,
    name: data.data[0].name,
    symbol: data.data[0].symbol,
    totalSupply: data.data[0].total_supply,
    creator: data.data[0].dev.creator_address,
    creatorBalance: data.data[0].dev.creator_token_balance,
    creatorStatus: data.data[0].dev.creator_token_status,
    quote: data.data[0].pool.quote_address
  }
}