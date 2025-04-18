// Dijkstra's algorithm with path reconstruction
function dijkstraWithPath(graph, source) {
    const dist = {};
    const prev = {};
    const unvisited = new Set();
    
    // Initialize distances and previous nodes
    Object.keys(graph).forEach(node => {
        dist[node] = Infinity;
        prev[node] = null;
        unvisited.add(node);
    });
    
    // Distance from source to itself is 0
    dist[source] = 0;
    
    // Process all nodes
    while (unvisited.size > 0) {
        // Find node with minimum distance
        let current = null;
        let minDist = Infinity;
        
        unvisited.forEach(node => {
            if (dist[node] < minDist) {
                minDist = dist[node];
                current = node;
            }
        });
        
        // If we can't find a node or remaining nodes are unreachable
        if (current === null || dist[current] === Infinity) {
            break;
        }
        
        // Remove current from unvisited
        unvisited.delete(current);
        
        // Check neighbors of current node
        for (const neighbor in graph[current]) {
            if (graph[current][neighbor] !== undefined) {
                const alt = dist[current] + graph[current][neighbor];
                
                // If we found a better path
                if (alt < dist[neighbor]) {
                    dist[neighbor] = alt;
                    prev[neighbor] = current;
                }
            }
        }
    }
    
    return { dist, prev };
}

// Reconstructs the shortest path from source to target
function reconstructPath(source, target, prev) {
    if (prev[target] === null && source !== target) return null;
    
    const path = [];
    let current = target;
    
    while (current !== null) {
        path.unshift(current);
        current = prev[current];
    }
    
    return path;
}

// Calculate shortest paths between all nodes using multiple Dijkstra runs
function calculateAllPairsShortest(graph) {
    const allDist = {};
    const allPrev = {};
    
    // Run Dijkstra from each node
    Object.keys(graph).forEach(source => {
        const { dist, prev } = dijkstraWithPath(graph, source);
        allDist[source] = dist;
        allPrev[source] = prev;
    });
    
    return { allDist, allPrev };
}

// Nearest Neighbor Heuristic for TSP
function tspNearestNeighbor(startNode, dist, nodes) {
    const unvisited = new Set(nodes);
    const path = [startNode];
    unvisited.delete(startNode);

    let currentNode = startNode;

    while (unvisited.size > 0) {
        let nearestNode = null;
        let minDistance = Infinity;

        unvisited.forEach(node => {
            if (dist[currentNode][node] < minDistance) {
                minDistance = dist[currentNode][node];
                nearestNode = node;
            }
        });

        path.push(nearestNode);
        unvisited.delete(nearestNode);
        currentNode = nearestNode;
    }

    // Add start node to the end to complete the cycle
    path.push(startNode);
    
    return path;
}

// Full TSP path calculation using Dijkstra instead of Floyd-Warshall
function calculateTSPWithDijkstra(startNode, deliveryPoints, originalGraph) {
    // Calculate shortest paths between all pairs using Dijkstra
    const { allDist, allPrev } = calculateAllPairsShortest(originalGraph);
    const nodes = [startNode, ...deliveryPoints];
    
    // Use the nearest neighbor algorithm for TSP
    const tspPath = tspNearestNeighbor(startNode, allDist, nodes);

    // Calculate the total distance of the TSP path
    let totalDistance = 0;
    for (let i = 0; i < tspPath.length - 1; i++) {
        const from = tspPath[i];
        const to = tspPath[i + 1];
        if (allDist[from][to] !== undefined && isFinite(allDist[from][to])) {
            totalDistance += allDist[from][to];
        }
    }

    // Reconstruct the full path with intermediate nodes
    const fullPath = [];
    for (let i = 0; i < tspPath.length - 1; i++) {
        const from = tspPath[i];
        const to = tspPath[i + 1];
        const segmentPath = reconstructPath(from, to, allPrev[from]);
        
        if (segmentPath && segmentPath.length > 0) {
            // Add all nodes except the last one to avoid duplicates
            fullPath.push(...segmentPath.slice(0, -1));
        }
    }

    // Add the final node to complete the path
    if (fullPath.length > 0 && tspPath.length > 0) {
        fullPath.push(tspPath[tspPath.length - 1]);
    }

    return { tspPath, fullPath, totalDistance };
}

// Fetch city names
async function fetchCityNames() {
    const response = await fetch('/static/city_names.txt');
    const text = await response.text();
    const lines = text.trim().split('\n');
    const names = {};
    
    lines.forEach(line => {
        const [id, name] = line.split(/\s(.+)/);
        if (id && name) {
            names[id] = name.trim();
        }
    });
    
    return names;
}

// Debug function to print information
function debugInfo(message, data) {
    console.log("DEBUG: " + message, data);
}

// Main graph loader and visualizer
async function loadGraphData() {
    try {
        const urlParams = new URLSearchParams(window.location.search);
        const startCityId = urlParams.get('startCity');
        const deliveryPointsParam = urlParams.get('deliveryPoints');
        
        // Debug logging
        debugInfo("URL Parameters:", { startCity: startCityId, deliveryPoints: deliveryPointsParam });
        
        // Parse deliveryPoints safely
        let deliveryPointIds = [];
        try {
            deliveryPointIds = JSON.parse(deliveryPointsParam).map(String);
        } catch (e) {
            console.error("Error parsing deliveryPoints:", e);
            debugInfo("Delivery Points Parameter:", deliveryPointsParam);
        }
        
        debugInfo("Delivery Points IDs:", deliveryPointIds);

        const response = await fetch('/static/graph.txt');
        const text = await response.text();
        const lines = text.split('\n').filter(Boolean);

        const distanceMatrix = {};
        const allCities = new Set();

        lines.forEach(line => {
            const [cityA, cityB, dist] = line.split(' ');
            const distance = parseFloat(dist);
            if (!distanceMatrix[cityA]) distanceMatrix[cityA] = {};
            if (!distanceMatrix[cityB]) distanceMatrix[cityB] = {};
            distanceMatrix[cityA][cityB] = distance;
            distanceMatrix[cityB][cityA] = distance;
            allCities.add(cityA);
            allCities.add(cityB);
        });

        const cityNames = await fetchCityNames();
        debugInfo("City Names:", cityNames);
        
        // Calculate TSP with total distance included in the return value
        const { tspPath, fullPath, totalDistance } = calculateTSPWithDijkstra(
            startCityId, 
            deliveryPointIds, 
            distanceMatrix
        );
        
        debugInfo("Total Distance:", totalDistance);
        
        // Create vertices with deliberate debugging for delivery points
        const vertices = [];
        
        Array.from(allCities).forEach(cityId => {
            // Check if this city is a delivery point with explicit debug
            const isDeliveryPoint = deliveryPointIds.includes(cityId.toString());
            const isStartCity = cityId.toString() === startCityId;
            
            debugInfo(`Checking city ${cityId}:`, {
                cityId: cityId,
                cityIdType: typeof cityId,
                isStartCity: isStartCity,
                isDeliveryPoint: isDeliveryPoint
            });
            
            let color = '#3498db'; // default blue
            let size = 20; // default size
            
            if (isStartCity) {
                color = '#1abc9c'; // green for start
                size = 35;
                debugInfo(`City ${cityId} is START CITY`);
            } else if (isDeliveryPoint) {
                color = '#e74c3c'; // red for delivery
                size = 30;
                debugInfo(`City ${cityId} is DELIVERY POINT`);
            }

            vertices.push({
                id: cityId,
                label: cityNames[cityId] || cityId,
                color: {
                    background: color,
                    border: '#000000',
                    highlight: {
                        background: color,
                        border: '#000000'
                    }
                },
                size: size,
                font: { 
                    color: '#000000', 
                    size: 16,
                    face: 'arial',
                    bold: isStartCity || isDeliveryPoint,
                    vadjust: -15, // Move labels above the nodes
                    background: 'rgba(255, 255, 255, 0.8)', // Add background to labels
                    strokeWidth: 4, // Add stroke around text for better visibility
                    strokeColor: 'rgba(255, 255, 255, 0.8)'
                }
            });
        });

        const edges = [];
        // Increased scale factor to space nodes better
        const scaleFactor = 0.8; // Significantly increased from 0.1

        // Create regular edges
        for (let cityA of allCities) {
            for (let cityB of Object.keys(distanceMatrix[cityA])) {
                if (cityA < cityB) { // Only add each edge once
                    const distance = distanceMatrix[cityA][cityB];
                    edges.push({
                        from: cityA,
                        to: cityB,
                        label: `${distance} km`,
                        font: { 
                            align: 'middle', 
                            size: 10,
                            background: 'rgba(255, 255, 255, 0.7)',
                            color: '#555555'
                        },
                        color: { color: '#aaaaaa' }, // Light gray for regular edges
                        width: 1,
                        length: distance * scaleFactor
                    });
                }
            }
        }

        // Highlight TSP path with a distinct visual appearance
        const pathEdges = [];
        for (let i = 0; i < fullPath.length - 1; i++) {
            const fromCity = fullPath[i];
            const toCity = fullPath[i + 1];
            pathEdges.push({
                from: fromCity,
                to: toCity,
                color: { color: '#2ecc71' }, // bright green
                width: 4,
                arrows: { to: { enabled: true, scaleFactor: 0.8 } },
                smooth: { enabled: true, type: 'curvedCW', roundness: 0.2 },
                label: `${distanceMatrix[fromCity][toCity]} km`,
                font: { 
                    align: 'middle', 
                    size: 12, 
                    color: '#006600',
                    background: 'rgba(255, 255, 255, 0.9)',
                    strokeWidth: 3,
                    strokeColor: 'rgba(255, 255, 255, 0.9)'
                }
            });
        }
        debugInfo("Path Edges:", pathEdges);
        edges.push(...pathEdges);

        // Visualize with vis.js
        const container = document.getElementById('network');
        const data = {
            nodes: new vis.DataSet(vertices),
            edges: new vis.DataSet(edges)
        };
        const options = {
            physics: {
                enabled: true,
                barnesHut: {
                    gravitationalConstant: -15000,  // Greatly increased repulsion
                    springLength: 300,             // Increased spring length
                    springConstant: 0.02,          // Lower spring constant
                    damping: 0.09,
                    centralGravity: 0.1           // Reduced central gravity
                },
                stabilization: {
                    iterations: 2000,
                    fit: true
                }
            },
            nodes: {
                shape: 'dot',
                borderWidth: 2,
                shadow: true,
                font: {
                    vadjust: -15, // Move label up
                }
            },
            edges: {
                smooth: {
                    type: 'continuous',
                    roundness: 0.2
                },
                shadow: true
            },
            layout: {
                improvedLayout: true,
                randomSeed: 42
            }
        };
        
        const network = new vis.Network(container, data, options);
        
        // Add event to ensure layouts are stable
        network.on("stabilizationIterationsDone", function() {
            console.log("Stabilization complete");
            network.setOptions({
                physics: {
                    enabled: false  // Turn off physics after stabilization
                }
            });
        });
        console.log("AAAAAAAA");
        // Pass the calculated totalDistance to the display function
        displayRouteInfo(startCityId, deliveryPointIds, tspPath, cityNames, distanceMatrix, totalDistance);
        
        // Print debugging summary
        console.log("=== VISUALIZATION COMPLETE ===");
        console.log("Start City:", startCityId);
        console.log("Delivery Points:", deliveryPointIds);
        console.log("Total Cities:", vertices.length);
        console.log("TSP Path:", tspPath);
        console.log("Total Distance:", totalDistance);
        
    } catch (error) {
        //console.error("Error in loadGraphData:", error);
        //document.getElementById('network').innerHTML = 
            `<div style="color:red; padding:20px;">
                <h3>Error loading graph data</h3>
                <p>${error.message}</p>
                <p>Check the console for more details.</p>
            </div>`;
    }
}

// Display route information with the calculated total distance
function displayRouteInfo(startCityId, deliveryPointIds, tspPath, cityNames, distanceMatrix, totalDistance) {
    const infoDiv = document.createElement('div');
    infoDiv.className = 'route-info';
    infoDiv.style.padding = '10px';
    infoDiv.style.margin = '10px';
    infoDiv.style.border = '1px solid #ccc';
    infoDiv.style.borderRadius = '5px';
    infoDiv.style.backgroundColor = '#f8f9fa';
    console.log("KAAM KAR RHA");
    let deliveryPointsStr = deliveryPointIds.map(id => `${id}: ${cityNames[id] || 'Unknown'}`).join(', ');
    
    infoDiv.innerHTML = `
        <h3>Delivery Route Information</h3>
        <p><strong>Starting City:</strong> ${cityNames[startCityId] || startCityId} (ID: ${startCityId})</p>
        <p><strong>Delivery Points:</strong> ${deliveryPointsStr}</p>
        <p><strong>Total Distance:</strong> ${totalDistance} km</p>
        <p><strong>Route Order:</strong> ${tspPath.map(id => `${cityNames[id] || id} (${id})`).join(' → ')}</p>
    `;
    
    // Find the container and append the info
    const container = document.getElementById('network');
    container.parentNode.insertBefore(infoDiv, container.nextSibling);
}

window.onload = loadGraphData;