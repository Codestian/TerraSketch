<script lang="ts">
    import WindowButton from "$lib/common/WindowButton.svelte";
    import { fromGeo, toGeo } from "@bte-germany/terraconvert";
  
    let topInput: string = "";
    let bottomInput: string = "";
    let isConvertingLatLng: boolean = true;
    let hasError: boolean = false;

    $: hasError = bottomInput.startsWith('Error:');
    
    // Reactive statement to automatically convert when input changes
    $: if (topInput.trim()) {
        handleConvert();
    } else {
        bottomInput = "";
    }
  
    function handleConvert() {
      console.log('Converting with isConvertingLatLng:', isConvertingLatLng);
      if (isConvertingLatLng) {
        // Validate the input format for LatLng
        const regex = /^([+-]?\d+(\.\d+)?)\s*,\s*([+-]?\d+(\.\d+)?)$/;
        const match = topInput.match(regex);
  
        if (match) {
          const lat = parseFloat(match[1]);
          const lng = parseFloat(match[3]);
  
          // Convert latitude and longitude to the desired coordinate system
          const coords = fromGeo(lat, lng);
  
          // Update the second input field with the converted coordinates
          bottomInput = `${coords[0]}, y, ${coords[1]}`;
        } else {
          bottomInput = 'Error: Invalid LatLng format. Please use "latitude, longitude".';
        }
      } else {
        // Validate the input format for Minecraft coordinates
        const regex = /^\s*([-+]?\d+(\.\d+)?)\s*,\s*([-+]?\d+(\.\d+)?)\s*,\s*([-+]?\d+(\.\d+)?)\s*$/;
        const match = topInput.match(regex);
  
        if (match) {
          // Logic for Minecraft to LatLng conversion (to be implemented)
          const x = parseFloat(match[1]);
          const y = parseFloat(match[3]);
          const z = parseFloat(match[5]);

          // Example: Conversion to geographic coordinates (LatLng)
          const coords = toGeo(x, z);
          bottomInput = `${coords[0]}, ${coords[1]}`;
        } else {
          bottomInput = 'Error: Invalid Minecraft format. Please use "x, y, z".';
        }
      }
    }
  
    function copyConvertedResult() {
      const inputElement = document.getElementById("convertedInput") as HTMLInputElement;
  
      if (inputElement) {
        const textToCopy = inputElement.value;
  
        navigator.clipboard.writeText(textToCopy).then(() => {
          alert("Text copied to clipboard!");
        }).catch((err) => {
          alert("Failed to copy text!");
        });
      }
    }
  
    function handleSwapClick() {
      // Toggle the boolean value
      isConvertingLatLng = !isConvertingLatLng;
      topInput = "";
      bottomInput = "";

    }
  </script>
  
  <div class="converter">
    <div class="row">
      <span class="label-text">{isConvertingLatLng ? 'LatLng' : 'Minecraft'}</span>
      <WindowButton iconClass="fas fa-right-left" onClick={handleSwapClick} square={true} />
      <span class="label-text">{isConvertingLatLng ? 'Minecraft' : 'LatLng'}</span>
    </div>
    
    <div class="input">
      <textarea
        placeholder={isConvertingLatLng ? "LatLng coordinates..." : "Minecraft coordinates..."}
        bind:value={topInput}
      ></textarea>
    </div>
  
    <div class="input">
      <textarea
        id="convertedInput"
        class:error={hasError}
        placeholder={isConvertingLatLng ? "Minecraft coordinates..." : "LatLng coordinates..."}
        bind:value={bottomInput}
        disabled
      ></textarea>
      <WindowButton iconClass="fa-regular fa-copy" onClick={copyConvertedResult} square={true} />
    </div>
  </div>
  
  <style lang="scss">
    .converter {
      display: flex;
      flex-direction: column;
      height: 100%;
      padding: 8px;
  
      .row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 8px;
        gap: 8px;

        .label-text {
          font-size: 0.7rem;
          height: 32px;
          color: white;
          padding: 4px 8px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          flex: 1;
          text-align: center;
          display: flex;
          letter-spacing: 1px;
          align-items: center;
          justify-content: center;
          user-select: none;
        }
      }
  
      .input {
        flex: 1;
        width: 100%;
        display: flex;
  
        textarea {
          width: 100%;
          padding: 12px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid transparent;
          color: white;
          font-size: 0.9rem;
          resize: none;

          &.error {
            color: #ff6b6b;
            background: rgba(255, 107, 107, 0.1);
            border: 1px solid rgba(255, 107, 107, 0.3);
          }

          &:focus {
            border: 1px solid rgba(255, 255, 255, 0.3);
            outline: none;
          }
  
        }
      }

      .input:nth-of-type(3) {
        background: rgba(0, 0, 0, 0.1);

        textarea {
          background: transparent;
          user-select: none;
        }
      }
    }
  </style>
  